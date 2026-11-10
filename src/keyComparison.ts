
export interface ComparisonResult {
    referenceKeys: string[];
    translationKeys: string[];
    missingKeys: string[];
    extraKeys: string[];
}

export function getAllKeys(
    data: Record<string, unknown>,
    prefix = ''
): string[] {
    const keys: string[] = [];

    for (const [key, value] of Object.entries(data)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
        ) {
            const nestedKeys = getAllKeys(
                value as Record<string, unknown>,
                fullKey
            );

            keys.push(...nestedKeys);
        } else {
            keys.push(fullKey);
        }
    }

    return keys;
}

export function compareKeys(
    referenceData: Record<string, unknown>,
    translationData: Record<string, unknown>
): ComparisonResult {
    const referenceKeys = getAllKeys(referenceData);
    const translationKeys = getAllKeys(translationData);

    const referenceSet = new Set(referenceKeys);
    const translationSet = new Set(translationKeys);

    const missingKeys = referenceKeys.filter(
        key => !translationSet.has(key)
    );

    const extraKeys = translationKeys.filter(
        key => !referenceSet.has(key)
    );

    return {
        referenceKeys,
        translationKeys,
        missingKeys,
        extraKeys
    };
}
