export interface ComparisonResult {
    referenceKeys: string[];
    translationKeys: string[];
    missingKeys: string[];
    extraKeys: string[];
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Use bracket notation for unusual names so a key named "a.b" is not
// confused with an object { "a": { "b": ... } }.
export function appendKeyPath(prefix: string, key: string): string {
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
        return prefix ? `${prefix}.${key}` : key;
    }

    return `${prefix}[${JSON.stringify(key)}]`;
}

function collectLeafKeys(value: unknown, prefix: string): string[] {
    if (!isJsonObject(value) || Object.keys(value).length === 0) {
        return [prefix];
    }

    const result: string[] = [];

    for (const [key, child] of Object.entries(value)) {
        result.push(...collectLeafKeys(child, appendKeyPath(prefix, key)));
    }

    return result;
}

export function getAllKeys(data: Record<string, unknown>): string[] {
    const result: string[] = [];

    for (const [key, value] of Object.entries(data)) {
        result.push(...collectLeafKeys(value, appendKeyPath('', key)));
    }

    return result;
}

export function compareKeys(
    referenceData: Record<string, unknown>,
    translationData: Record<string, unknown>
): ComparisonResult {
    const missingKeys: string[] = [];
    const extraKeys: string[] = [];

    function visit(
        reference: Record<string, unknown>,
        translation: Record<string, unknown>,
        prefix: string
    ): void {
        for (const [key, referenceValue] of Object.entries(reference)) {
            const fullKey = appendKeyPath(prefix, key);

            if (!Object.prototype.hasOwnProperty.call(translation, key)) {
                missingKeys.push(...collectLeafKeys(referenceValue, fullKey));
                continue;
            }

            const translationValue = translation[key];

            if (isJsonObject(referenceValue)) {
                if (isJsonObject(translationValue)) {
                    visit(referenceValue, translationValue, fullKey);
                } else {
                    // A scalar cannot contain the reference object's leaves.
                    // The validator separately reports the parent type mismatch.
                    if (Object.keys(referenceValue).length > 0) {
                        missingKeys.push(...collectLeafKeys(referenceValue, fullKey));
                    }
                }
            }
        }

        for (const [key, translationValue] of Object.entries(translation)) {
            if (!Object.prototype.hasOwnProperty.call(reference, key)) {
                extraKeys.push(
                    ...collectLeafKeys(translationValue, appendKeyPath(prefix, key))
                );
            }
        }
    }

    visit(referenceData, translationData, '');

    return {
        referenceKeys: getAllKeys(referenceData),
        translationKeys: getAllKeys(translationData),
        missingKeys,
        extraKeys
    };
}
