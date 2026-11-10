import * as vscode from 'vscode';

import { compareKeys } from './keyComparison';
import { validateTranslations } from './validation';

import {
    calculateProgress,
    createMarkdownReport
} from './report';

import { getCheckerSettings } from './settings';
import { showResultsPanel } from './resultsPanel';

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel(
        'JSON Translation Checker'
    );

    const compareCommand = vscode.commands.registerCommand(
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
                const settings = getCheckerSettings();

                const referenceData = await readJsonFile(
                    referenceFile
                );

                const translationData = await readJsonFile(
                    translationFile
                );

                const rawComparison = compareKeys(
                    referenceData,
                    translationData
                );

                const rawValidation = validateTranslations(
                    referenceData,
                    translationData
                );

                const comparison = {
                    ...rawComparison,
                    extraKeys: settings.checkExtraKeys
                        ? rawComparison.extraKeys
                        : []
                };

                const validation = {
                    emptyKeys: settings.checkEmptyTranslations
                        ? rawValidation.emptyKeys
                        : [],

                    typeMismatches: settings.checkValueTypes
                        ? rawValidation.typeMismatches
                        : []
                };

                const summary = calculateProgress(
                    comparison,
                    validation
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
                    `Всего ключей: ${summary.total}`
                );

                output.appendLine(
                    `Корректных переводов: ${summary.valid}`
                );

                output.appendLine(
                    `Заполненность: ${summary.percentage.toFixed(1)}%`
                );

                output.appendLine('');

                output.appendLine(
                    `Отсутствующих ключей: ${comparison.missingKeys.length}`
                );

                output.appendLine(
                    'Лишних ключей: ' +
                    formatCount(
                        comparison.extraKeys.length,
                        settings.checkExtraKeys
                    )
                );

                output.appendLine(
                    'Пустых переводов: ' +
                    formatCount(
                        validation.emptyKeys.length,
                        settings.checkEmptyTranslations
                    )
                );

                output.appendLine(
                    'Несовпадений типов: ' +
                    formatCount(
                        validation.typeMismatches.length,
                        settings.checkValueTypes
                    )
                );

                appendSection(
                    output,
                    'Отсутствующие ключи',
                    comparison.missingKeys,
                    true
                );

                appendSection(
                    output,
                    'Лишние ключи',
                    comparison.extraKeys,
                    settings.checkExtraKeys
                );

                appendSection(
                    output,
                    'Пустые переводы',
                    validation.emptyKeys,
                    settings.checkEmptyTranslations
                );

                const mismatches = validation.typeMismatches.map(
                    mismatch =>
                        `${mismatch.key}: ` +
                        `${mismatch.expected} -> ${mismatch.actual}`
                );

                appendSection(
                    output,
                    'Несовпадения типов',
                    mismatches,
                    settings.checkValueTypes
                );

                output.show();

                showResultsPanel(
                    referenceFile,
                    translationFile,
                    comparison,
                    validation,
                    settings
                );

                if (!settings.promptToSaveReport) {
                    return;
                }

                const action = await vscode.window.showInformationMessage(
                    `Проверка завершена. Заполненность: ${summary.percentage.toFixed(1)}%`,
                    'Сохранить отчёт'
                );

                if (action !== 'Сохранить отчёт') {
                    return;
                }

                const reportFile = await vscode.window.showSaveDialog({
                    title: 'Сохранить Markdown-отчёт',
                    defaultUri: vscode.Uri.joinPath(
                        translationFile,
                        '..',
                        'translation-report.md'
                    ),
                    filters: {
                        Markdown: ['md']
                    }
                });

                if (!reportFile) {
                    return;
                }

                const report = createMarkdownReport(
                    referenceFile.fsPath,
                    translationFile.fsPath,
                    comparison,
                    validation,
                    settings
                );

                await vscode.workspace.fs.writeFile(
                    reportFile,
                    Buffer.from(report, 'utf8')
                );

                await vscode.window.showInformationMessage(
                    `Отчёт сохранён: ${reportFile.fsPath}`
                );

            } catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : 'Неизвестная ошибка';

                await vscode.window.showErrorMessage(message);
            }
        }
    );

    const settingsCommand = vscode.commands.registerCommand(
        'jsonTranslationChecker.openSettings',
        async () => {
            await vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'jsonTranslationChecker'
            );
        }
    );

    context.subscriptions.push(
        compareCommand,
        settingsCommand,
        output
    );
}

function formatCount(
    count: number,
    enabled: boolean
): string {
    return enabled ? String(count) : 'проверка отключена';
}

function appendSection(
    output: vscode.OutputChannel,
    title: string,
    keys: string[],
    enabled: boolean
): void {
    output.appendLine('');
    output.appendLine(`${title}:`);

    if (!enabled) {
        output.appendLine('- Проверка отключена');
        return;
    }

    if (keys.length === 0) {
        output.appendLine('- Нет');
        return;
    }

    for (const key of keys) {
        output.appendLine(`- ${key}`);
    }
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