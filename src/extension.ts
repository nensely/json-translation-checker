import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
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

            await vscode.window.showInformationMessage(
                `Эталон: ${referenceFile.fsPath}. ` +
                `Проверяемый файл: ${translationFile.fsPath}.`
            );
        }
    );

    context.subscriptions.push(command);
}

export function deactivate() {}