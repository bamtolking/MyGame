import type { ScanRecord } from '../state/store';
import demo from './demo-scan.json';

/** 스캔 전 미리 보여 주는 예시 리포트 (사진 없음, 측정선만) */
export const DEMO_SCAN = demo as unknown as ScanRecord;
