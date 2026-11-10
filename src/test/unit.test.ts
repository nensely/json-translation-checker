import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { compareKeys, getAllKeys } from '../keyComparison';
import { validateTranslations } from '../validation';
import { calculateProgress, createMarkdownReport } from '../report';
import type { CheckerSettings } from '../settings';

const settings: CheckerSettings = {
    checkEmptyTranslations: true,
    checkValueTypes: true,
    checkExtraKeys: true,
    promptToSaveReport: true
};

function inspect(reference: Record<string, unknown>, translation: Record<string, unknown>) {
    const comparison = compareKeys(reference, translation);
    const validation = validateTranslations(reference, translation);
    const summary = calculateProgress(comparison, validation);
    return { comparison, validation, summary };
}

test('finds missing and extra keys in nested objects', () => {
    const { comparison } = inspect(
        { title: 'Главная', menu: { save: 'Сохранить', cancel: 'Отмена' } },
        { title: 'Home', menu: { save: 'Save' }, debug: 'Debug' }
    );
    assert.deepEqual(comparison.missingKeys, ['menu.cancel']);
    assert.deepEqual(comparison.extraKeys, ['debug']);
});

test('counts reference leaves, including empty objects and arrays', () => {
    assert.deepEqual(
        getAllKeys({ menu: { save: 'Save' }, empty: {}, list: [1, 2], nil: null }),
        ['menu.save', 'empty', 'list', 'nil']
    );
});

test('does not confuse literal dots with nested paths', () => {
    const result = compareKeys(
        { 'a.b': 'x', a: { b: 'y' } },
        { 'a.b': 'ok', a: {} }
    );
    assert.deepEqual(result.referenceKeys, ['["a.b"]', 'a.b']);
    assert.deepEqual(result.missingKeys, ['a.b']);
});

test('supports keys containing quotes, spaces and empty strings', () => {
    assert.deepEqual(getAllKeys({ '': 'x', 'a"b': 'y', 'a b': 'z' }), [
        '[""]', '["a\\"b"]', '["a b"]'
    ]);
});

test('ignores object prototype keys when comparing JSON names', () => {
    const reference = JSON.parse('{"toString":"x","constructor":"y"}') as Record<string, unknown>;
    const translation = JSON.parse('{"toString":"a"}') as Record<string, unknown>;
    assert.deepEqual(compareKeys(reference, translation).missingKeys, ['constructor']);
});

test('detects empty and whitespace-only translations', () => {
    const { validation } = inspect(
        { title: 'Главная', menu: { save: 'Сохранить' } },
        { title: ' \n ', menu: { save: '' } }
    );
    assert.deepEqual(validation.emptyKeys, ['title', 'menu.save']);
});

test('detects number, array and null type mismatches', () => {
    const { validation } = inspect(
        { a: 'text', b: [1], c: null },
        { a: 12, b: 'wrong', c: false }
    );
    assert.deepEqual(validation.typeMismatches, [
        { key: 'a', expected: 'string', actual: 'number' },
        { key: 'b', expected: 'array', actual: 'string' },
        { key: 'c', expected: 'null', actual: 'boolean' }
    ]);
});

test('does not interpret an object-to-string mismatch as an extra key', () => {
    const { comparison, validation, summary } = inspect(
        { menu: { save: 'Save', close: 'Close' } },
        { menu: 'broken' }
    );
    assert.deepEqual(comparison.missingKeys, ['menu.save', 'menu.close']);
    assert.deepEqual(comparison.extraKeys, []);
    assert.deepEqual(validation.typeMismatches, [
        { key: 'menu', expected: 'object', actual: 'string' }
    ]);
    assert.equal(summary.valid, 0);
    assert.equal(summary.total, 2);
});

test('detects scalar-to-object mismatch', () => {
    const { validation, summary } = inspect({ title: 'Hello' }, { title: { en: 'Hello' } });
    assert.equal(validation.typeMismatches.length, 1);
    assert.equal(summary.percentage, 0);
});

test('returns the expected percentage for the manual example', () => {
    const { summary } = inspect(
        { title: 'Главная', menu: { save: 'Сохранить', cancel: 'Отмена' }, items: ['a'], counter: 2 },
        { title: '   ', menu: { save: 45 }, items: 'wrong', counter: 2, debug: 'Debug' }
    );
    assert.deepEqual(summary, { total: 5, valid: 1, percentage: 20 });
});

test('reports 100 percent for identical valid objects', () => {
    const { summary } = inspect({ a: 'A', b: { c: 1 } }, { a: 'B', b: { c: 3 } });
    assert.equal(summary.percentage, 100);
});

test('defines coverage of two empty JSON objects as 100 percent', () => {
    const { summary } = inspect({}, {});
    assert.deepEqual(summary, { total: 0, valid: 0, percentage: 100 });
});

test('disabled empty and type checks change the measured coverage', () => {
    const { comparison, validation } = inspect(
        { a: 'A', b: 'B', c: 'C' },
        { a: '', b: 100, c: 'ok' }
    );
    assert.ok(Math.abs(calculateProgress(comparison, validation).percentage - 100 / 3) < 1e-10);
    assert.ok(Math.abs(calculateProgress(comparison, { ...validation, emptyKeys: [] }).percentage - 200 / 3) < 1e-10);
    assert.equal(calculateProgress(comparison, { emptyKeys: [], typeMismatches: [] }).percentage, 100);
});

test('Markdown report includes counts and settings', () => {
    const { comparison, validation } = inspect(
        { title: 'Hello', menu: { ok: 'OK' } },
        { title: '   ', menu: {} }
    );
    const report = createMarkdownReport('ru.json', 'en.json', comparison, validation, settings);
    assert.match(report, /Заполненность \| 0\.0%/);
    assert.match(report, /menu\.ok/);
    assert.match(report, /title/);
});

test('Markdown report marks skipped checks, without claiming zero errors', () => {
    const { comparison, validation } = inspect({ a: 'x' }, { a: '' });
    const report = createMarkdownReport(
        'ru.json', 'en.json', comparison,
        { ...validation, emptyKeys: [] },
        { ...settings, checkEmptyTranslations: false }
    );
    assert.match(report, /Не проверялось/);
    assert.match(report, /Проверка отключена/);
});
