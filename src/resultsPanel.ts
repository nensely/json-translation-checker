import * as vscode from 'vscode';
import * as path from 'path';
import { randomBytes } from 'crypto';

import type { ComparisonResult } from './keyComparison';
import type { ValidationResult } from './validation';
import type { CheckerSettings } from './settings';

import { calculateProgress } from './report';

let resultsPanel: vscode.WebviewPanel | undefined;

function escapeHtml(value: string): string {
    const replacements: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };

    return value.replace(
        /[&<>"']/g,
        character => replacements[character]
    );
}

function renderKeyList(keys: string[]): string {
    if (keys.length === 0) {
        return '<p class="empty">Проблем не найдено</p>';
    }

    const items = keys.map(
        key => `<li><code>${escapeHtml(key)}</code></li>`
    );

    return `<ul class="key-list">${items.join('')}</ul>`;
}

function renderMismatchList(
    validation: ValidationResult
): string {
    if (validation.typeMismatches.length === 0) {
        return '<p class="empty">Проблем не найдено</p>';
    }

    const items = validation.typeMismatches.map(
        mismatch => {
            const key = escapeHtml(mismatch.key);
            const expected = escapeHtml(mismatch.expected);
            const actual = escapeHtml(mismatch.actual);

            return `
                <li>
                    <code>${key}</code>
                    <span class="type-description">
                        ${expected} → ${actual}
                    </span>
                </li>
            `;
        }
    );

    return `<ul class="key-list">${items.join('')}</ul>`;
}

function renderSection(
    title: string,
    count: number,
    enabled: boolean,
    content: string
): string {
    const status = enabled
        ? String(count)
        : 'Отключено';

    const body = enabled
        ? content
        : '<p class="empty">Проверка отключена в настройках</p>';

    return `
        <section class="section">
            <div class="section-header">
                <h2>${escapeHtml(title)}</h2>
                <span class="count">${status}</span>
            </div>

            ${body}
        </section>
    `;
}

function createPanelHtml(
    referenceFile: vscode.Uri,
    translationFile: vscode.Uri,
    comparison: ComparisonResult,
    validation: ValidationResult,
    settings: CheckerSettings
): string {
    const summary = calculateProgress(
        comparison,
        validation
    );

    const nonce = randomBytes(16).toString('base64');

    const referenceName = escapeHtml(
        path.basename(referenceFile.fsPath)
    );

    const translationName = escapeHtml(
        path.basename(translationFile.fsPath)
    );

    const referencePath = escapeHtml(
        referenceFile.fsPath
    );

    const translationPath = escapeHtml(
        translationFile.fsPath
    );

    const missingSection = renderSection(
        'Отсутствующие ключи',
        comparison.missingKeys.length,
        true,
        renderKeyList(comparison.missingKeys)
    );

    const extraSection = renderSection(
        'Лишние ключи',
        comparison.extraKeys.length,
        settings.checkExtraKeys,
        renderKeyList(comparison.extraKeys)
    );

    const emptySection = renderSection(
        'Пустые переводы',
        validation.emptyKeys.length,
        settings.checkEmptyTranslations,
        renderKeyList(validation.emptyKeys)
    );

    const mismatchSection = renderSection(
        'Несовпадения типов',
        validation.typeMismatches.length,
        settings.checkValueTypes,
        renderMismatchList(validation)
    );

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">

    <meta
        http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'nonce-${nonce}';"
    >

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>JSON Translation Checker</title>

    <style nonce="${nonce}">
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 28px;

            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);

            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }

        .container {
            max-width: 1100px;
            margin: 0 auto;
        }

        h1 {
            margin: 0 0 8px;
            font-size: 26px;
            font-weight: 600;
        }

        .subtitle {
            margin-bottom: 28px;
            color: var(--vscode-descriptionForeground);
        }

        .file-info {
            display: grid;
            grid-template-columns: repeat(
                auto-fit,
                minmax(230px, 1fr)
            );
            gap: 14px;
            margin-bottom: 28px;
        }

        .file-card {
            padding: 16px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;

            background: var(--vscode-sideBar-background);
        }

        .file-label {
            margin-bottom: 8px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .file-name {
            margin-bottom: 6px;
            font-weight: 600;
        }

        .file-path {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            overflow-wrap: anywhere;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(
                auto-fit,
                minmax(150px, 1fr)
            );
            gap: 14px;
            margin-bottom: 30px;
        }

        .stat-card {
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;

            background: var(--vscode-sideBar-background);
        }

        .stat-value {
            margin-bottom: 10px;
            font-size: 32px;
            font-weight: 700;
        }

        .stat-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .section-title {
            margin-bottom: 16px;
            font-size: 19px;
            font-weight: 600;
        }

        .sections {
            display: grid;
            grid-template-columns: repeat(
                auto-fit,
                minmax(280px, 1fr)
            );
            gap: 16px;
        }

        .section {
            padding: 18px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            background: var(--vscode-sideBar-background);
        }

        .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;

            margin-bottom: 18px;
        }

        .section h2 {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
        }

        .count {
            padding: 4px 9px;
            border-radius: 5px;

            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);

            font-size: 12px;
            white-space: nowrap;
        }

        .key-list {
            margin: 0;
            padding-left: 20px;
        }

        .key-list li {
            margin-bottom: 10px;
            line-height: 1.6;
            overflow-wrap: anywhere;
        }

        code {
            padding: 3px 6px;
            border-radius: 4px;

            font-family: var(--vscode-editor-font-family);
            font-size: 12px;

            background: var(--vscode-textCodeBlock-background);
        }

        .type-description {
            display: block;
            margin-top: 6px;

            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .empty {
            margin: 0;
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
        }

        .footer {
            margin-top: 28px;
            padding-top: 16px;

            border-top: 1px solid var(--vscode-panel-border);

            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>

<body>
    <main class="container">

        <h1>JSON Translation Checker</h1>

        <p class="subtitle">
            Результаты проверки файлов локализации
        </p>

        <div class="file-info">

            <div class="file-card">
                <div class="file-label">Эталонный файл</div>
                <div class="file-name">${referenceName}</div>
                <div class="file-path">${referencePath}</div>
            </div>

            <div class="file-card">
                <div class="file-label">Проверяемый перевод</div>
                <div class="file-name">${translationName}</div>
                <div class="file-path">${translationPath}</div>
            </div>

        </div>

        <div class="stats">

            <div class="stat-card">
                <div class="stat-value">${summary.total}</div>
                <div class="stat-label">Всего ключей</div>
            </div>

            <div class="stat-card">
                <div class="stat-value">${summary.valid}</div>
                <div class="stat-label">Корректных переводов</div>
            </div>

            <div class="stat-card">
                <div class="stat-value">
                    ${summary.percentage.toFixed(1)}%
                </div>
                <div class="stat-label">Заполненность</div>
            </div>

            <div class="stat-card">
                <div class="stat-value">
                    ${comparison.missingKeys.length}
                </div>
                <div class="stat-label">Отсутствующих ключей</div>
            </div>

        </div>

        <h2 class="section-title">Обнаруженные проблемы</h2>

        <div class="sections">
            ${missingSection}
            ${extraSection}
            ${emptySection}
            ${mismatchSection}
        </div>

        <div class="footer">
            Результаты рассчитаны с учётом настроек расширения.
            Лишние ключи не влияют на процент заполненности.
        </div>

    </main>
</body>
</html>
`;
}

export function showResultsPanel(
    referenceFile: vscode.Uri,
    translationFile: vscode.Uri,
    comparison: ComparisonResult,
    validation: ValidationResult,
    settings: CheckerSettings
): void {
    let panel = resultsPanel;

    if (!panel) {
        panel = vscode.window.createWebviewPanel(
            'jsonTranslationChecker.results',
            'JSON Translation Checker',
            vscode.ViewColumn.Beside,
            {
                enableScripts: false,
                localResourceRoots: []
            }
        );

        resultsPanel = panel;

        const createdPanel = panel;

        panel.onDidDispose(() => {
            if (resultsPanel === createdPanel) {
                resultsPanel = undefined;
            }
        });
    }

    panel.webview.html = createPanelHtml(
        referenceFile,
        translationFile,
        comparison,
        validation,
        settings
    );

    panel.reveal(vscode.ViewColumn.Beside);
}