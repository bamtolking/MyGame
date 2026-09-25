"""export.luau가 내보낸 파트 목록을 간단한 레이캐스팅으로 그림(PNG)으로 그립니다.

사용: python render.py <scene.json> <out.png> <view>
  view: top | base | plaza | gallery
필요: numpy, pillow
"""
import json
import math
import sys

import numpy as np
from PIL import Image


def normalize(v):
    return v / np.linalg.norm(v)


def load(path):
    parts = []
    for p in json.load(open(path)):
        if p["t"] >= 0.85:
            continue
        cf = p["cf"]
        pos = np.array(cf[0:3])
        R = np.array(cf[3:12]).reshape(3, 3)
        parts.append({
            "name": p["n"],
            "shape": p["sh"],
            "size": np.array(p["s"]),
            "pos": pos,
            "R": R,
            "color": np.array(p["c"]),
            "t": p["t"],
            "mat": p["m"],
        })
    return parts


def camera(target, direction, up_hint, width_studs, px_w, px_h):
    fwd = normalize(np.array(direction, dtype=float))
    right = normalize(np.cross(fwd, np.array(up_hint, dtype=float)))
    up = np.cross(right, fwd)
    return {"target": np.array(target, dtype=float), "fwd": fwd, "right": right, "up": up,
            "scale": width_studs / px_w, "w": px_w, "h": px_h}


def intersect(part, O, D):
    """O, D: (N,3) 월드 좌표 광선. 반환 (t, normal_world) — 맞지 않으면 t=inf"""
    R = part["R"]
    o = (O - part["pos"]) @ R  # R^T (O-p)
    d = D @ R
    s = part["size"]
    n = O.shape[0]
    t = np.full(n, np.inf)
    nl = np.zeros((n, 3))
    shape = part["shape"]
    eps = 1e-9
    if shape in ("Sphere", "Ball"):
        r = s / 2 if shape == "Sphere" else np.full(3, s.min() / 2)
        o2, d2 = o / r, d / r
        a = (d2 * d2).sum(1)
        b = 2 * (o2 * d2).sum(1)
        c = (o2 * o2).sum(1) - 1
        disc = b * b - 4 * a * c
        ok = disc >= 0
        sq = np.sqrt(np.where(ok, disc, 0))
        t0 = (-b - sq) / (2 * a + eps)
        t1 = (-b + sq) / (2 * a + eps)
        tt = np.where(t0 > 0, t0, t1)
        ok &= tt > 0
        t = np.where(ok, tt, np.inf)
        hit = o + d * np.where(ok, tt, 0)[:, None]
        nl = hit / (r * r)
    elif shape == "Cylinder":
        rad = min(s[1], s[2]) / 2
        hl = s[0] / 2
        a = d[:, 1] ** 2 + d[:, 2] ** 2
        b = 2 * (o[:, 1] * d[:, 1] + o[:, 2] * d[:, 2])
        c = o[:, 1] ** 2 + o[:, 2] ** 2 - rad * rad
        disc = b * b - 4 * a * c
        ok = (disc >= 0) & (a > eps)
        sq = np.sqrt(np.where(ok, disc, 0))
        best = np.full(n, np.inf)
        bn = np.zeros((n, 3))
        for sign in (-1, 1):
            tt = (-b + sign * sq) / (2 * a + eps)
            x = o[:, 0] + d[:, 0] * tt
            good = ok & (tt > 0) & (np.abs(x) <= hl) & (tt < best)
            best = np.where(good, tt, best)
            hit = o + d * tt[:, None]
            nn = np.stack([np.zeros(n), hit[:, 1], hit[:, 2]], 1)
            bn = np.where(good[:, None], nn, bn)
        for cap in (-hl, hl):
            tt = (cap - o[:, 0]) / np.where(np.abs(d[:, 0]) > eps, d[:, 0], eps)
            hit = o + d * tt[:, None]
            good = (tt > 0) & (hit[:, 1] ** 2 + hit[:, 2] ** 2 <= rad * rad) & (tt < best)
            best = np.where(good, tt, best)
            bn = np.where(good[:, None], np.array([np.sign(cap), 0, 0]), bn)
        t = best
        nl = bn
    else:
        h = s / 2
        dd = np.where(np.abs(d) > eps, d, eps)
        t1 = (-h - o) / dd
        t2 = (h - o) / dd
        tmin_ax = np.minimum(t1, t2)
        tmax_ax = np.maximum(t1, t2)
        tmin = tmin_ax.max(1)
        tmax = tmax_ax.min(1)
        ok = (tmax >= np.maximum(tmin, 0))
        tt = np.where(tmin > 0, tmin, tmax)
        t = np.where(ok & (tt > 0), tt, np.inf)
        axis = tmin_ax.argmax(1)
        nl = np.zeros((n, 3))
        nl[np.arange(n), axis] = -np.sign(dd[np.arange(n), axis])
    nw = nl @ R.T
    norm = np.linalg.norm(nw, axis=1, keepdims=True)
    nw = nw / np.where(norm > 0, norm, 1)
    return t, nw


def render(parts, cam, sky_top=(0.55, 0.75, 1.0), sky_bottom=(0.85, 0.93, 1.0)):
    w, h = cam["w"], cam["h"]
    ys, xs = np.mgrid[0:h, 0:w]
    u = (xs - w / 2) * cam["scale"]
    v = (h / 2 - ys) * cam["scale"]
    centers = cam["target"] - cam["fwd"] * 2000
    O = centers + u[..., None] * cam["right"] + v[..., None] * cam["up"]
    O = O.reshape(-1, 3)
    D = np.broadcast_to(cam["fwd"], O.shape)
    depth = np.full(O.shape[0], np.inf)
    color = np.zeros((O.shape[0], 3))
    grad = np.linspace(0, 1, h)[:, None, None]
    bg = (np.array(sky_top) * (1 - grad) + np.array(sky_bottom) * grad)
    bg = np.broadcast_to(bg, (h, w, 3)).reshape(-1, 3)
    color[:] = bg
    light = normalize(np.array([-0.4, 1.0, 0.55]))

    for part in parts:
        rel = part["pos"] - cam["target"]
        pu = rel @ cam["right"] / cam["scale"] + w / 2
        pv = h / 2 - rel @ cam["up"] / cam["scale"]
        rad = np.linalg.norm(part["size"]) / 2 / cam["scale"] + 2
        x0, x1 = int(max(0, pu - rad)), int(min(w, pu + rad + 1))
        y0, y1 = int(max(0, pv - rad)), int(min(h, pv + rad + 1))
        if x0 >= x1 or y0 >= y1:
            continue
        idx = (np.arange(y0, y1)[:, None] * w + np.arange(x0, x1)[None, :]).reshape(-1)
        t, nw = intersect(part, O[idx], D[idx])
        closer = t < depth[idx]
        if not closer.any():
            continue
        sel = idx[closer]
        depth[sel] = t[closer]
        base = part["color"]
        if part["mat"] == "Neon":
            shade = np.ones(sel.shape[0]) * 1.15
        else:
            lam = np.clip(nw[closer] @ light, 0, 1)
            shade = 0.5 + 0.6 * lam
        c = np.clip(base[None, :] * shade[:, None], 0, 1)
        if part["mat"] in ("Glass", "ForceField") or part["t"] > 0.1:
            c = c * 0.75 + 0.25
        color[sel] = c
    img = (np.clip(color, 0, 1) * 255).astype(np.uint8).reshape(h, w, 3)
    return Image.fromarray(img)


def main():
    src, out, view = sys.argv[1], sys.argv[2], sys.argv[3]
    parts = load(src)
    if view == "top":
        cam = camera((0, 0, -28), (0, -1, 0), (0, 0, 1), 380, 900, 1100)
    elif view == "base":
        # 동쪽 1번 기지(남쪽 끝)를 도로 쪽 위에서 비스듬히
        cam = camera((68, 4, -114), (1.0, -0.75, 0.55), (0, 1, 0), 120, 1100, 800)
    elif view == "plaza":
        cam = camera((0, 8, -150), (0.25, -0.45, -1.0), (0, 1, 0), 190, 1100, 750)
    elif view == "gallery":
        cam = camera((22.5, -28, 40), (0.0, -0.12, -1.0), (0, 1, 0), 64, 1100, 1250)
    else:
        raise SystemExit("unknown view")
    render(parts, cam).save(out)
    print("saved", out)


if __name__ == "__main__":
    main()
