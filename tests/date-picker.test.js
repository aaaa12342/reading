import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDate} from '../js/date-picker.js';
test('日期支持连续输入、短月份和常见分隔符',()=>{
 for(const value of ['20261002','2026-10-2','2026/10/02','2026.10.02','2026年10月2日',' 2026-10-02 '])assert.equal(parseDate(value),'2026-10-02');
});
test('不将未输入完整或不存在的日期转为有效日期',()=>{
 for(const value of ['','2026','2026-10','202610','2026-02-29','2026-04-31','2026-13-01','2026-00-01','20/10/2026'])assert.equal(parseDate(value),null);
 assert.equal(parseDate('20240229'),'2024-02-29');
});
