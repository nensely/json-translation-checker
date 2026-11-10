import { appendKeyPath, isJsonObject } from './keyComparison';

export interface TypeMismatch {
    key: string;
    expected: string;
    actual: string;
}

export interface ValidationResult {
    emptyKeys: string[];
    typeMismatches: TypeMismatch[];
}

export function getValueType(value: unknown): string {
    if (value === null) {
        return 'null';
    }

    if (Array.isArray(value)) {
        return 'array';
    }

    return typeof value;
}

export function validateTranslations(
    referenceData: Record<string, unknown>,
    translationData: Record<string, unknown>,
    prefix = ''
): ValidationResult {
    const result: ValidationResult = {
        emptyKeys: [],
        typeMismatches: []
    };

    for (const [key, referenceValue] of Object.entries(referenceData)) {
        if (!Object.prototype.hasOwnProperty.call(translationData, key)) {
            continue;
        }

        const translationValue = translationData[key];
        const fullKey = appendKeyPath(prefix, key);
        const expected = getValueType(referenceValue);
        const actual = getValueType(translationValue);

        if (expected !== actual) {
            result.typeMismatches.push({ key: fullKey, expected, actual });
            continue;
        }

        if (isJsonObject(referenceValue) && isJsonObject(translationValue)) {
            const nested = validateTranslations(
                referenceValue,
                translationValue,
                fullKey
            );

            result.emptyKeys.push(...nested.emptyKeys);
            result.typeMismatches.push(...nested.typeMismatches);
        } else if (
            expected === 'string' &&
            (translationValue as string).trim().length === 0
        ) {
            result.emptyKeys.push(fullKey);
        }
    }

    return result;
}
