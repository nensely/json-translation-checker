import * as vscode from 'vscode';

export interface CheckerSettings {
    checkEmptyTranslations: boolean;
    checkValueTypes: boolean;
    checkExtraKeys: boolean;
    promptToSaveReport: boolean;
}

export function getCheckerSettings(): CheckerSettings {
    const config = vscode.workspace.getConfiguration(
        'jsonTranslationChecker'
    );

    return {
        checkEmptyTranslations: config.get<boolean>(
            'checkEmptyTranslations',
            true
        ),

        checkValueTypes: config.get<boolean>(
            'checkValueTypes',
            true
        ),

        checkExtraKeys: config.get<boolean>(
            'checkExtraKeys',
            true
        ),

        promptToSaveReport: config.get<boolean>(
            'promptToSaveReport',
            true
        )
    };
}