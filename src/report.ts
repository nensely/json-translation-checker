import type { ComparisonResult } from './keyComparison';
import type { ValidationResult } from './validation';
import type { CheckerSettings } from './settings';

export interface ReportSummary {
    total: number;
    valid: number;
    percentage: number;
}

export function calculateProgress(
    comparison: ComparisonResult,
    validation: ValidationResult
): ReportSummary {
    const invalidKeys = new Set<string>();

    for (const key of comparison.missingKeys) {
        invalidKeys.add(key);
    }

    for (const key of validation.emptyKeys) {
        invalidKeys.add(key);
    }

    for (const mismatch of validation.typeMismatches) {
        invalidKeys.add(mismatch.key);
    }

    const total = comparison.referenceKeys.length;

    const valid = comparison.referenceKeys.filter(
        key => !invalidKeys.has(key)
    ).length;

    const percentage = total === 0
        ? 100
        : (valid / total) * 100;

    return {
        total,
        valid,
        percentage
    };
}

function formatList(keys: string[]): string {
    if (keys.length === 0) {
        return '- Нет';
    }

    return keys.map(
        key => `- \`${key}\``
    ).join('\n');
}

function formatSection(
    keys: string[],
    enabled: boolean
): string {
    if (!enabled) {
        return 'Проверка отключена';
    }

    return formatList(keys);
}

function formatCount(
    count: number,
    enabled: boolean
): string {
    return enabled ? String(count) : 'Не проверялось';
}

export function createMarkdownReport(
    referencePath: string,
    translationPath: string,
    comparison: ComparisonResult,
    validation: ValidationResult,
    settings: CheckerSettings
): string {
    const summary = calculateProgress(
        comparison,
        validation
    );

    const mismatches = validation.typeMismatches.map(
        mismatch =>
            `${mismatch.key}: ${mismatch.expected} -> ${mismatch.actual}`
    );

    return [
        '# JSON Translation Checker',
        '',
        '## Проверяемые файлы',
        '',
        `Эталон: \`${referencePath}\``,
        '',
        `Перевод: \`${translationPath}\``,
        '',
        '## Статистика',
        '',
        '| Показатель | Значение |',
        '| --- | ---: |',
        `| Всего ключей | ${summary.total} |`,
        `| Корректных переводов | ${summary.valid} |`,
        `| Заполненность | ${summary.percentage.toFixed(1)}% |`,
        `| Отсутствующих ключей | ${comparison.missingKeys.length} |`,
        `| Лишних ключей | ${formatCount(
            comparison.extraKeys.length,
            settings.checkExtraKeys
        )} |`,
        `| Пустых переводов | ${formatCount(
            validation.emptyKeys.length,
            settings.checkEmptyTranslations
        )} |`,
        `| Несовпадений типов | ${formatCount(
            validation.typeMismatches.length,
            settings.checkValueTypes
        )} |`,
        '',
        '## Отсутствующие ключи',
        '',
        formatList(comparison.missingKeys),
        '',
        '## Лишние ключи',
        '',
        formatSection(
            comparison.extraKeys,
            settings.checkExtraKeys
        ),
        '',
        '## Пустые переводы',
        '',
        formatSection(
            validation.emptyKeys,
            settings.checkEmptyTranslations
        ),
        '',
        '## Несовпадения типов',
        '',
        formatSection(
            mismatches,
            settings.checkValueTypes
        ),
        ''
    ].join('\n');
}