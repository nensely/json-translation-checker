import type { ComparisonResult } from './keyComparison';
import type { ValidationResult } from './validation';
import type { CheckerSettings } from './settings';

export interface ReportSummary {
    total: number;
    valid: number;
    percentage: number;
}

function isSameOrChildPath(path: string, ancestor: string): boolean {
    return path === ancestor ||
        path.startsWith(`${ancestor}.`) ||
        path.startsWith(`${ancestor}[`);
}

export function calculateProgress(
    comparison: ComparisonResult,
    validation: ValidationResult
): ReportSummary {
    const invalidPaths = [
        ...comparison.missingKeys,
        ...validation.emptyKeys,
        ...validation.typeMismatches.map(item => item.key)
    ];

    const total = comparison.referenceKeys.length;
    const valid = comparison.referenceKeys.filter(
        key => !invalidPaths.some(invalid => isSameOrChildPath(key, invalid))
    ).length;

    return {
        total,
        valid,
        percentage: total === 0 ? 100 : (valid / total) * 100
    };
}

function inlineCode(value: string): string {
    const matches = value.match(/`+/g) ?? [];
    const longest = Math.max(0, ...matches.map(match => match.length));
    const ticks = '`'.repeat(longest + 1);
    const text = value.replace(/\r?\n/g, ' ');
    const padding = text.startsWith('`') || text.endsWith('`') ? ' ' : '';

    return `${ticks}${padding}${text}${padding}${ticks}`;
}

function formatList(keys: string[]): string {
    return keys.length > 0
        ? keys.map(key => `- ${inlineCode(key)}`).join('\n')
        : '- Нет';
}

function formatSection(keys: string[], enabled: boolean): string {
    return enabled ? formatList(keys) : '- Проверка отключена';
}

function formatCount(count: number, enabled: boolean): string {
    return enabled ? String(count) : 'Не проверялось';
}

export function createMarkdownReport(
    referencePath: string,
    translationPath: string,
    comparison: ComparisonResult,
    validation: ValidationResult,
    settings: CheckerSettings
): string {
    const summary = calculateProgress(comparison, validation);
    const mismatches = validation.typeMismatches.map(
        mismatch => `${mismatch.key}: ${mismatch.expected} -> ${mismatch.actual}`
    );

    return [
        '# JSON Translation Checker',
        '',
        '## Проверяемые файлы',
        '',
        `Эталон: ${inlineCode(referencePath)}`,
        '',
        `Перевод: ${inlineCode(translationPath)}`,
        '',
        '## Статистика',
        '',
        '| Показатель | Значение |',
        '| --- | ---: |',
        `| Всего ключей | ${summary.total} |`,
        `| Корректных переводов | ${summary.valid} |`,
        `| Заполненность | ${summary.percentage.toFixed(1)}% |`,
        `| Отсутствующих ключей | ${comparison.missingKeys.length} |`,
        `| Лишних ключей | ${formatCount(comparison.extraKeys.length, settings.checkExtraKeys)} |`,
        `| Пустых переводов | ${formatCount(validation.emptyKeys.length, settings.checkEmptyTranslations)} |`,
        `| Несовпадений типов | ${formatCount(validation.typeMismatches.length, settings.checkValueTypes)} |`,
        '',
        '## Отсутствующие ключи',
        '',
        formatList(comparison.missingKeys),
        '',
        '## Лишние ключи',
        '',
        formatSection(comparison.extraKeys, settings.checkExtraKeys),
        '',
        '## Пустые переводы',
        '',
        formatSection(validation.emptyKeys, settings.checkEmptyTranslations),
        '',
        '## Несовпадения типов',
        '',
        formatSection(mismatches, settings.checkValueTypes),
        ''
    ].join('\n');
}
