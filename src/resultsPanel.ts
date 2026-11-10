import * as vscode from 'vscode';
import * as path from 'path';
import { randomBytes } from 'crypto';

import type { ComparisonResult } from './keyComparison';
import type { ValidationResult } from './validation';
import type { CheckerSettings } from './settings';
import { calculateProgress } from './report';

interface ResultsSnapshot {
    referenceFile: vscode.Uri;
    translationFile: vscode.Uri;
    comparison: ComparisonResult;
    validation: ValidationResult;
    settings: CheckerSettings;
    saveReport: () => Promise<void>;
}

let resultsPanel: vscode.WebviewPanel | undefined;
let latestSnapshot: ResultsSnapshot | undefined;

function escapeHtml(text: string): string {
    const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };

    return text.replace(/[&<>"']/g, character => entities[character]);
}

function issueRow(kind: string, label: string, key: string, detail = ''): string {
    const search = escapeHtml(`${key} ${detail}`.toLowerCase());
    const safeKey = escapeHtml(key);
    const detailHtml = detail
        ? `<span class="issue-detail">${escapeHtml(detail)}</span>`
        : '';

    return `<li class="issue" data-kind="${kind}" data-search="${search}">
        <span class="issue-type ${kind}">${label}</span>
        <code>${safeKey}</code>
        ${detailHtml}
    </li>`;
}

function buildHtml(snapshot: ResultsSnapshot): string {
    const { referenceFile, translationFile, comparison, validation, settings } = snapshot;
    const summary = calculateProgress(comparison, validation);
    const nonce = randomBytes(16).toString('base64');

    const missing = comparison.missingKeys.length;
    const extra = comparison.extraKeys.length;
    const empty = validation.emptyKeys.length;
    const types = validation.typeMismatches.length;
    const totalIssues = missing + extra + empty + types;
    const denominator = Math.max(totalIssues, 1);
    const percent = summary.percentage.toFixed(1);

    const issues = [
        ...comparison.missingKeys.map(key => issueRow('missing', 'Отсутствует', key)),
        ...comparison.extraKeys.map(key => issueRow('extra', 'Лишний', key)),
        ...validation.emptyKeys.map(key => issueRow('empty', 'Пустой', key)),
        ...validation.typeMismatches.map(item =>
            issueRow('type', 'Тип', item.key, `${item.expected} → ${item.actual}`)
        )
    ];

    const referenceName = escapeHtml(path.basename(referenceFile.fsPath));
    const translationName = escapeHtml(path.basename(translationFile.fsPath));
    const referencePath = escapeHtml(referenceFile.fsPath);
    const translationPath = escapeHtml(translationFile.fsPath);

    function disabledLabel(enabled: boolean, count: number): string {
        return enabled ? String(count) : 'выкл.';
    }

    function chartRow(kind: string, name: string, count: number, enabled: boolean): string {
        const note = enabled ? String(count) : 'выкл.';
        return `<div class="chart-row">
            <span>${name}</span>
            <div class="chart-track"><div class="chart-fill ${kind}"></div></div>
            <strong>${note}</strong>
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JSON Translation Checker</title>
<style nonce="${nonce}">
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        font: 14px/1.5 var(--vscode-font-family);
        padding: 26px;
        margin: 0;
    }
    .layout { margin: 0 auto; max-width: 1050px; }
    h1 { font-size: 25px; margin: 0 0 6px; }
    h2 { font-size: 17px; margin: 0 0 16px; }
    .muted { color: var(--vscode-descriptionForeground); }
    .heading { display: flex; flex-wrap: wrap; gap: 14px; align-items: center;
        justify-content: space-between; margin-bottom: 24px; }
    .heading p { margin: 0; }
    .actions { display: flex; gap: 9px; flex-wrap: wrap; }
    button { padding: 8px 12px; border: 1px solid var(--vscode-button-border, transparent);
        border-radius: 6px; cursor: pointer; font: inherit; }
    button:focus-visible, input:focus-visible {
        outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px;
    }
    .primary { background: var(--vscode-button-background);
        color: var(--vscode-button-foreground); }
    .primary:hover { background: var(--vscode-button-hoverBackground); }
    .secondary { background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground); }
    .secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .files, .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px; margin-bottom: 18px; }
    .stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .card { padding: 17px; border: 1px solid var(--vscode-panel-border);
        background: var(--vscode-sideBar-background); border-radius: 9px; min-width: 0; }
    .label { font-size: 12px; color: var(--vscode-descriptionForeground); }
    .filename { font-weight: 650; font-size: 15px; margin: 5px 0; }
    .path { color: var(--vscode-descriptionForeground); overflow-wrap: anywhere;
        font-size: 12px; }
    .number { font-size: 29px; font-weight: 700; line-height: 1.2; margin-bottom: 8px; }
    .visuals { display: grid; grid-template-columns: 240px minmax(0, 1fr);
        gap: 14px; margin-bottom: 24px; }
    .ring-area { display: grid; justify-items: center; gap: 10px; }
    .ring { width: 145px; height: 145px; border-radius: 50%; display: grid; place-items: center;
        background: conic-gradient(var(--vscode-charts-green, #35a66a) 0 ${percent}%,
        var(--vscode-editorWidget-border, #52525b) ${percent}% 100%); }
    .ring-center { width: 113px; height: 113px; border-radius: 50%;
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        background: var(--vscode-sideBar-background); }
    .ring-center strong { font-size: 25px; }
    .chart-row { display: grid; grid-template-columns: 126px minmax(30px,1fr) 42px;
        align-items: center; gap: 12px; margin: 13px 0; font-size: 12px; }
    .chart-track { border-radius: 5px; background: var(--vscode-editorWidget-border, #52525b);
        height: 11px; overflow: hidden; }
    .chart-fill { height: 100%; border-radius: 5px; }
    .chart-fill.missing { width: ${(missing / denominator * 100).toFixed(2)}%; background: var(--vscode-charts-red, #df6060); }
    .chart-fill.extra { width: ${(extra / denominator * 100).toFixed(2)}%; background: var(--vscode-charts-blue, #5798d3); }
    .chart-fill.empty { width: ${(empty / denominator * 100).toFixed(2)}%; background: var(--vscode-charts-yellow, #e5b34e); }
    .chart-fill.type { width: ${(types / denominator * 100).toFixed(2)}%; background: var(--vscode-charts-orange, #e18b44); }
    .chart-row strong { text-align: right; }
    .toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
        margin: 10px 0 14px; }
    .filters { display: flex; gap: 6px; flex-wrap: wrap; }
    .filter { border: 1px solid var(--vscode-panel-border);
        background: var(--vscode-sideBar-background); color: var(--vscode-editor-foreground); }
    .filter.selected { background: var(--vscode-button-background);
        color: var(--vscode-button-foreground); }
    .search { min-width: 180px; flex: 1; background: var(--vscode-input-background);
        color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border,
        var(--vscode-panel-border)); border-radius: 6px; padding: 9px 12px; font: inherit; }
    .issue-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
    .issue { border: 1px solid var(--vscode-panel-border); border-radius: 7px;
        background: var(--vscode-sideBar-background); padding: 12px;
        display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .issue[hidden] { display: none; }
    .issue code { overflow-wrap: anywhere; font-family: var(--vscode-editor-font-family);
        padding: 2px 5px; background: var(--vscode-textCodeBlock-background); border-radius: 3px; }
    .issue-type { font-weight: 600; font-size: 11px; border-radius: 4px;
        padding: 3px 7px; border: 1px solid var(--vscode-panel-border); }
    .issue-detail { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .issue-summary, .empty-state { margin: 12px 0; color: var(--vscode-descriptionForeground); }
    .footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid
        var(--vscode-panel-border); font-size: 12px; }
    @media (max-width: 750px) {
        body { padding: 14px; }
        .stats { grid-template-columns: repeat(2,minmax(0,1fr)); }
        .visuals { grid-template-columns: 1fr; }
    }
    @media (max-width: 480px) {
        .files { grid-template-columns: 1fr; }
        .chart-row { grid-template-columns: 100px minmax(25px,1fr) 38px; }
    }
</style>
</head>
<body>
<main class="layout">
    <header class="heading">
        <div>
            <h1>JSON Translation Checker</h1>
            <p class="muted">Статистика и результаты проверки локализации</p>
        </div>
        <div class="actions">
            <button class="secondary" id="settings" type="button">Настройки</button>
            <button class="primary" id="save" type="button">Сохранить отчёт</button>
        </div>
    </header>

    <section class="files" aria-label="Проверенные файлы">
        <div class="card"><span class="label">Эталон</span>
            <div class="filename">${referenceName}</div><div class="path">${referencePath}</div></div>
        <div class="card"><span class="label">Перевод</span>
            <div class="filename">${translationName}</div><div class="path">${translationPath}</div></div>
    </section>

    <section class="stats" aria-label="Итоговые показатели">
        <div class="card"><div class="number">${summary.total}</div><span class="label">Всего ключей</span></div>
        <div class="card"><div class="number">${summary.valid}</div><span class="label">Корректных</span></div>
        <div class="card"><div class="number">${percent}%</div><span class="label">Заполненность</span></div>
        <div class="card"><div class="number">${totalIssues}</div><span class="label">Найденных проблем*</span></div>
    </section>

    <section class="visuals" aria-label="Графики">
        <div class="card ring-area">
            <div class="ring" role="img" aria-label="Заполненность ${percent}%">
                <div class="ring-center"><strong>${percent}%</strong>
                    <span class="label">${summary.valid} из ${summary.total}</span></div>
            </div>
            <span class="label">Корректные переводы</span>
        </div>
        <div class="card">
            <h2>Проблемы по категориям</h2>
            ${chartRow('missing', 'Отсутствующие', missing, true)}
            ${chartRow('extra', 'Лишние', extra, settings.checkExtraKeys)}
            ${chartRow('empty', 'Пустые', empty, settings.checkEmptyTranslations)}
            ${chartRow('type', 'Неверный тип', types, settings.checkValueTypes)}
            <p class="label">Диаграмма показывает долю каждой категории среди обнаруженных проблем.</p>
        </div>
    </section>

    <section aria-label="Список проблем">
        <h2>Обнаруженные проблемы</h2>
        <div class="toolbar">
            <div class="filters" role="group" aria-label="Фильтр по типу проблемы">
                <button class="filter selected" type="button" data-filter="all" aria-pressed="true">Все</button>
                <button class="filter" type="button" data-filter="missing" aria-pressed="false">Отсутствуют (${missing})</button>
                <button class="filter" type="button" data-filter="extra" aria-pressed="false">Лишние (${disabledLabel(settings.checkExtraKeys, extra)})</button>
                <button class="filter" type="button" data-filter="empty" aria-pressed="false">Пустые (${disabledLabel(settings.checkEmptyTranslations, empty)})</button>
                <button class="filter" type="button" data-filter="type" aria-pressed="false">Типы (${disabledLabel(settings.checkValueTypes, types)})</button>
            </div>
            <input class="search" id="search" type="search" placeholder="Поиск по ключам" aria-label="Поиск по ключам">
        </div>
        <p class="issue-summary" id="count" aria-live="polite">Показано: ${totalIssues}</p>
        <ul class="issue-list" id="issues">${issues.join('\n')}</ul>
        <p class="empty-state" id="empty-state" ${totalIssues > 0 ? 'hidden' : ''}>Нет проблем по выбранному фильтру.</p>
    </section>

    <div class="footer muted">
        * Категории могут пересекаться: например, у вложенного объекта может одновременно
        быть ошибка типа и отсутствовать несколько ключей. Массивы сравниваются только по типу.
        Отключённые проверки не влияют на процент заполненности. Включите все проверки
        для полной диагностики.
    </div>
</main>
<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
    const rows = Array.from(document.querySelectorAll('.issue'));
    const search = document.getElementById('search');
    const count = document.getElementById('count');
    const emptyState = document.getElementById('empty-state');
    let currentFilter = 'all';

    function update() {
        const query = search.value.trim().toLowerCase();
        let visible = 0;
        for (const row of rows) {
            const matchesType = currentFilter === 'all' || row.dataset.kind === currentFilter;
            const matchesText = !query || (row.dataset.search || '').includes(query);
            row.hidden = !(matchesType && matchesText);
            if (!row.hidden) { visible += 1; }
        }
        count.textContent = 'Показано: ' + visible;
        emptyState.hidden = visible > 0;
    }

    for (const button of filterButtons) {
        button.addEventListener('click', () => {
            currentFilter = button.dataset.filter || 'all';
            for (const item of filterButtons) {
                const selected = item === button;
                item.classList.toggle('selected', selected);
                item.setAttribute('aria-pressed', String(selected));
            }
            update();
        });
    }
    search.addEventListener('input', update);
    document.getElementById('save').addEventListener('click', () => {
        vscode.postMessage({ command: 'saveReport' });
    });
    document.getElementById('settings').addEventListener('click', () => {
        vscode.postMessage({ command: 'openSettings' });
    });
    update();
</script>
</body>
</html>`;
}

export function showResultsPanel(
    referenceFile: vscode.Uri,
    translationFile: vscode.Uri,
    comparison: ComparisonResult,
    validation: ValidationResult,
    settings: CheckerSettings,
    saveReport: () => Promise<void>
): void {
    latestSnapshot = {
        referenceFile,
        translationFile,
        comparison,
        validation,
        settings,
        saveReport
    };

    if (!resultsPanel) {
        const createdPanel = vscode.window.createWebviewPanel(
            'jsonTranslationChecker.results',
            'JSON Translation Checker',
            vscode.ViewColumn.Beside,
            { enableScripts: true, localResourceRoots: [] }
        );

        resultsPanel = createdPanel;

        createdPanel.onDidDispose(() => {
            if (resultsPanel === createdPanel) {
                resultsPanel = undefined;
            }
        });

        createdPanel.webview.onDidReceiveMessage(async (message: unknown) => {
            if (!message || typeof message !== 'object' || !('command' in message)) {
                return;
            }

            if (message.command === 'openSettings') {
                await vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    'jsonTranslationChecker'
                );
            } else if (message.command === 'saveReport' && latestSnapshot) {
                try {
                    await latestSnapshot.saveReport();
                } catch (error) {
                    const detail = error instanceof Error ? error.message : String(error);
                    await vscode.window.showErrorMessage(`Не удалось сохранить отчёт: ${detail}`);
                }
            }
        });
    }

    resultsPanel.webview.html = buildHtml(latestSnapshot);
    resultsPanel.reveal(vscode.ViewColumn.Beside);
}
