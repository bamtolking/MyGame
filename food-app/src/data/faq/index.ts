// 자주 묻는 질문. 묶음 파일마다 식품 5~6개 또는 성분 7개씩 나눠 담는다.
import type { FaqMap } from '../types';
import { FAQ_F01 } from './food-01';
import { FAQ_F02 } from './food-02';
import { FAQ_F03 } from './food-03';
import { FAQ_F04 } from './food-04';
import { FAQ_F05 } from './food-05';
import { FAQ_F06 } from './food-06';
import { FAQ_F07 } from './food-07';
import { FAQ_F08 } from './food-08';
import { FAQ_F09 } from './food-09';
import { FAQ_F10 } from './food-10';
import { FAQ_F11 } from './food-11';
import { FAQ_F12 } from './food-12';
import { FAQ_C01 } from './compound-01';
import { FAQ_C02 } from './compound-02';
import { FAQ_C03 } from './compound-03';
import { FAQ_C04 } from './compound-04';
import { FAQ_C05 } from './compound-05';
import { FAQ_C06 } from './compound-06';
import { FAQ_C07 } from './compound-07';
import { FAQ_C08 } from './compound-08';
import { FAQ_C09 } from './compound-09';

export const FOOD_FAQ: FaqMap = { ...FAQ_F01, ...FAQ_F02, ...FAQ_F03, ...FAQ_F04, ...FAQ_F05, ...FAQ_F06, ...FAQ_F07, ...FAQ_F08, ...FAQ_F09, ...FAQ_F10, ...FAQ_F11, ...FAQ_F12 };
export const COMPOUND_FAQ: FaqMap = { ...FAQ_C01, ...FAQ_C02, ...FAQ_C03, ...FAQ_C04, ...FAQ_C05, ...FAQ_C06, ...FAQ_C07, ...FAQ_C08, ...FAQ_C09 };
