
export interface TypeMismatch {
    key: string;
    expected: string;
    actual: string;
}

export interface ValidationResult {
    emptyKeys: string[];
    typeMismatches: TypeMismatch[];
}

function getValueType(value: unknown): string {
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
        const fullKey = prefix ? `${prefix}.${key}` : key;

        const referenceType = getValueType(referenceValue);
        const translationType = getValueType(translationValue);

        if (referenceType !== translationType) {
            result.typeMismatches.push({
                key: fullKey,
                expected: referenceType,
                actual: translationType
            });

            continue;
        }

        if (referenceType === 'object') {
            const nestedResult = validateTranslations(
                referenceValue as Record<string, unknown>,
                translationValue as Record<string, unknown>,
                fullKey
            );

            result.emptyKeys.push(...nestedResult.emptyKeys);
            result.typeMismatches.push(...nestedResult.typeMismatches);
        }

        if (
            referenceType === 'string' &&
            (translationValue as string).trim().length === 0
        ) {
            result.emptyKeys.push(fullKey);
        }
    }

    return result;
}
