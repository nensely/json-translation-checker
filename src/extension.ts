
import * as vscode from 'vscode';
import { compareKeys } from './keyComparison';
import { validateTranslations } from './validation';

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel(
        'JSON Translation Checker'
    );

    const command = vscode.commands.registerCommand(
        'jsonTranslationChecker.compare',
        async () => {
            const referenceFiles = await vscode.window.showOpenDialog({
                title: 'Выберите эталонный файл переводов',
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    JSON: ['json']
                }
            });

            if (!referenceFiles || referenceFiles.length === 0) {
                return;
            }

            const translationFiles = await vscode.window.showOpenDialog({
                title: 'Выберите файл для проверки',
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    JSON: ['json']
                }
            });

            if (!translationFiles || translationFiles.length === 0) {
                return;
            }

            const referenceFile = referenceFiles[0];
            const translationFile = translationFiles[0];

            try {
                const referenceData = await readJsonFile(referenceFile);
                const translationData = await readJsonFile(translationFile);

                const comparison = compareKeys(
                    referenceData,
                    translationData
                );

                const validation = validateTranslations(
                    referenceData,
                    translationData
                );

                output.clear();

                output.appendLine('JSON Translation Checker');
                output.appendLine('');

                output.appendLine(
                    `Эталон: ${referenceFile.fsPath}`
                );

                output.appendLine(
                    `Перевод: ${translationFile.fsPath}`
                );

                output.appendLine('');

                output.appendLine(
                    `Ключей в эталоне: ${comparison.referenceKeys.length}`
                );

                output.appendLine(
                    `Ключей в переводе: ${comparison.translationKeys.length}`
                );

                output.appendLine(
                    `Отсутствующих ключей: ${comparison.missingKeys.length}`
                );

                output.appendLine(
                    `Лишних ключей: ${comparison.extraKeys.length}`
                );

                output.appendLine(
                    `Пустых переводов: ${validation.emptyKeys.length}`
                );

                output.appendLine(
                    `Несовпадений типов: ${validation.typeMismatches.length}`
                );

                output.appendLine('');
                output.appendLine('Отсутствующие ключи:');

                for (const key of comparison.missingKeys) {
                    output.appendLine(`- ${key}`);
                }

                output.appendLine('');
                output.appendLine('Лишние ключи:');

                for (const key of comparison.extraKeys) {
                    output.appendLine(`- ${key}`);
                }

                output.appendLine('');
                output.appendLine('Пустые переводы:');

                for (const key of validation.emptyKeys) {
                    output.appendLine(`- ${key}`);
                }

                output.appendLine('');
                output.appendLine('Несовпадения типов:');

                for (const mismatch of validation.typeMismatches) {
                    output.appendLine(
                        `- ${mismatch.key}: ` +
                        `${mismatch.expected} -> ${mismatch.actual}`
                    );
                }

                output.show();

            } catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : 'Неизвестная ошибка';

                await vscode.window.showErrorMessage(message);
            }
        }
    );

    context.subscriptions.push(command, output);
}

async function readJsonFile(
    file: vscode.Uri
): Promise<Record<string, unknown>> {
    let bytes: Uint8Array;

    try {
        bytes = await vscode.workspace.fs.readFile(file);
    } catch {
        throw new Error(
            `Не удалось прочитать файл: ${file.fsPath}`
        );
    }

    const text = Buffer.from(bytes).toString('utf8');

    let data: unknown;

    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(
            `Некорректный JSON в файле: ${file.fsPath}`
        );
    }

    if (
        typeof data !== 'object' ||
        data === null ||
        Array.isArray(data)
    ) {
        throw new Error(
            `В файле должен находиться JSON-объект: ${file.fsPath}`
        );
    }

    return data as Record<string, unknown>;
}

export function deactivate() {}
