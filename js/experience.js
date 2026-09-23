// experience.js
// Turns the semantic CV markup in experience.html into a Windows 95 Explorer:
// a folder tree on the left, a Details view / company pane on the right.
//
// The HTML is the single source of truth. Everything here is derived from it
// (durations, promotions, the tree, the listings), so durations never go stale
// and adding a job means adding one <article> to the page.
//
// Selection is routed through location.hash, which gives deep links
// (/experience#integralis) and back/forward for free. Below 720px, and in
// print, the CSS drops the explorer layout and the same markup reads as a
// plain stacked CV.
(function () {
    'use strict';

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // ---- Dates -------------------------------------------------------------
    // Month precision only. "YYYY-MM" is split by hand: new Date('2025-02')
    // parses as UTC and lands on Jan 31 in timezones west of Greenwich.

    function parseYearMonth(value) {
        const [year, month] = value.split('-').map(Number);
        return year * 12 + (month - 1);
    }

    function currentMonth() {
        const now = new Date();
        return now.getFullYear() * 12 + now.getMonth();
    }

    function formatMonth(month) {
        return `${MONTH_NAMES[month % 12]} ${Math.floor(month / 12)}`;
    }

    function formatSpan(start, end) {
        return `${formatMonth(start)} – ${end === null ? 'Present' : formatMonth(end)}`;
    }

    // LinkedIn counts both the first and the last month: Feb 2025 – Apr 2026 is
    // 15 months ("1 yr 3 mos").
    function formatTenure(start, end) {
        const months = (end === null ? currentMonth() : end) - start + 1;
        const years = Math.floor(months / 12);
        const rest = months % 12;
        const parts = [];
        if (years) parts.push(`${years} ${years === 1 ? 'yr' : 'yrs'}`);
        if (rest) parts.push(`${rest} ${rest === 1 ? 'mo' : 'mos'}`);
        return parts.join(' ');
    }

    // ---- Model -------------------------------------------------------------
    // Folder:  { kind: 'folder',  id, label, el, parent, children }
    // Company: { kind: 'company', id, label, el, parent, category, roles, start, end }
    // Role:    { id, el, title, type, start, end, company }   (end null = Present)

    function readRole(el, company) {
        const times = el.querySelector('.xp-meta').querySelectorAll('time');
        const typeEl = el.querySelector('.xp-type');
        return {
            id: el.id,
            el,
            title: el.querySelector('.xp-role-title').textContent.trim(),
            type: typeEl ? typeEl.textContent.trim() : '',
            start: parseYearMonth(times[0].getAttribute('datetime')),
            end: times[1].hasAttribute('datetime') ? parseYearMonth(times[1].getAttribute('datetime')) : null,
            company
        };
    }

    function readCompany(el, parent) {
        const company = {
            kind: 'company',
            id: el.id,
            label: el.querySelector('.xp-company-name').textContent.trim(),
            el,
            parent,
            category: el.dataset.category
        };
        company.roles = Array.from(el.querySelectorAll('.xp-role'), roleEl => readRole(roleEl, company));
        company.start = Math.min(...company.roles.map(role => role.start));
        company.end = company.roles.some(role => role.end === null)
            ? null
            : Math.max(...company.roles.map(role => role.end));
        return company;
    }

    function readFolder(el, parent) {
        const folder = { kind: 'folder', id: el.id, label: el.dataset.label, el, parent, children: [] };
        for (const child of el.children) {
            if (child.matches('.xp-company')) folder.children.push(readCompany(child, folder));
            else if (child.matches('.xp-folder')) folder.children.push(readFolder(child, folder));
        }
        return folder;
    }

    function walk(node, visit) {
        visit(node);
        if (node.kind === 'folder') node.children.forEach(child => walk(child, visit));
    }

    // ---- Decorating the article markup ---------------------------------------

    function appendTenure(metaEl, start, end) {
        const tenure = document.createElement('span');
        tenure.className = 'xp-tenure';
        tenure.textContent = formatTenure(start, end);
        metaEl.append(' · ', tenure);
    }

    function decorateCompany(company) {
        company.roles.forEach(role => appendTenure(role.el.querySelector('.xp-meta'), role.start, role.end));

        // Like LinkedIn, only multi-role companies get a total; for a single
        // role it would just repeat the role's own dates.
        if (company.roles.length > 1) {
            const span = document.createElement('p');
            span.className = 'xp-meta xp-company-span';
            span.textContent = formatSpan(company.start, company.end);
            appendTenure(span, company.start, company.end);
            company.el.querySelector('.xp-company-name').after(span);
        }

        // Roles are newest first. A role that starts in the month the one below
        // it ended was a promotion; the marker closes the newer role, so it sits
        // between the two.
        company.roles.forEach((newer, index) => {
            const older = company.roles[index + 1];
            if (older && older.end === newer.start) {
                const marker = document.createElement('p');
                marker.className = 'xp-promotion';
                marker.innerHTML = '<span aria-hidden="true">▲</span> Promoted';
                newer.el.append(marker);
            }
        });
    }

    // ---- Explorer --------------------------------------------------------------

    function initExplorer() {
        const windowEl = document.querySelector('.xp-window');
        const root = readFolder(document.getElementById('experience'), null);

        const nodes = new Map();   // id -> folder | company
        const roles = new Map();   // id -> role
        walk(root, node => {
            nodes.set(node.id, node);
            if (node.kind === 'company') {
                decorateCompany(node);
                node.roles.forEach(role => roles.set(role.id, role));
            }
        });

        const toolbar = windowEl.querySelector('.xp-toolbar');
        const upButton = toolbar.querySelector('.xp-up');
        const addressField = toolbar.querySelector('.xp-address-field');
        const filterInput = toolbar.querySelector('.xp-filter-input');
        const treePane = windowEl.querySelector('.xp-tree-pane');
        const statusBar = windowEl.querySelector('.xp-statusbar');
        const statusCount = statusBar.querySelector('.xp-status-count');
        const statusDetail = statusBar.querySelector('.xp-status-detail');
        const explorerLayout = window.matchMedia('(min-width: 720px)');

        const treeItems = new Map();    // node id -> li[role=treeitem]
        const listingRows = new Map();  // node id -> tr (in its parent's listing)
        let current = root;

        // -- Listings (Details view of a folder) --

        function positionText(node) {
            if (node.kind === 'folder') return '';
            // Oldest to newest, so a promotion ladder reads left to right
            return node.roles.map(role => role.title).reverse().join(' → ');
        }

        function typeText(node) {
            return node.kind === 'folder' ? 'File Folder' : node.roles[0].type;
        }

        function renderListing(folder) {
            const listing = document.createElement('div');
            listing.className = 'xp-listing';
            listing.innerHTML = `
                <table class="xp-details">
                    <caption class="xp-visually-hidden"></caption>
                    <thead>
                        <tr>
                            <th scope="col">Name</th>
                            <th scope="col" class="xp-col-position">Position</th>
                            <th scope="col" class="xp-col-type">Type</th>
                            <th scope="col" class="xp-col-dates">Dates</th>
                            <th scope="col" class="xp-col-duration">Duration</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>`;
            listing.querySelector('caption').textContent = `Contents of ${folder.label}`;
            const tbody = listing.querySelector('tbody');

            folder.children.forEach(node => {
                const row = document.createElement('tr');
                const isCompany = node.kind === 'company';
                row.innerHTML = `
                    <th scope="row"><a href="#${node.id}"><span class="xp-icon xp-icon--folder" aria-hidden="true"></span></a></th>
                    <td class="xp-col-position"></td>
                    <td class="xp-col-type"></td>
                    <td class="xp-col-dates"></td>
                    <td class="xp-col-duration"></td>`;
                row.querySelector('a').append(node.label);
                row.querySelector('.xp-col-position').textContent = positionText(node);
                row.querySelector('.xp-col-type').textContent = typeText(node);
                row.querySelector('.xp-col-dates').textContent = isCompany ? formatSpan(node.start, node.end) : '';
                row.querySelector('.xp-col-duration').textContent = isCompany ? formatTenure(node.start, node.end) : '';

                // Win95 Details view: the whole row is the hit target, not just the name
                row.addEventListener('click', event => {
                    if (!event.target.closest('a')) navigate(node.id);
                });

                listingRows.set(node.id, row);
                tbody.append(row);
            });

            // Sits at the top of the folder: after the page header for the
            // root, after the folder heading for sub-folders
            const anchor = folder.el.querySelector(':scope > .xp-doc-header, :scope > .xp-folder-name');
            anchor.after(listing);
            folder.children.filter(child => child.kind === 'folder').forEach(renderListing);
        }

        // -- Tree --

        function renderTreeItem(node) {
            const item = document.createElement('li');
            item.setAttribute('role', 'treeitem');
            item.setAttribute('aria-selected', 'false');
            item.tabIndex = -1;
            item.dataset.node = node.id;

            const row = document.createElement('span');
            row.className = 'xp-tree-row';
            const hasChildren = node.kind === 'folder' && node.children.length > 0;
            const iconClass = node === root ? 'xp-icon--briefcase' : 'xp-icon--folder';
            row.innerHTML = `
                <span class="xp-twisty" aria-hidden="true"></span>
                <span class="xp-icon ${iconClass}" aria-hidden="true"></span>
                <span class="xp-tree-label"></span>`;
            const label = row.querySelector('.xp-tree-label');
            label.textContent = node.label;
            // Otherwise a folder's accessible name would include all its children
            label.id = `xp-tree-label-${node.id}`;
            item.setAttribute('aria-labelledby', label.id);
            item.append(row);

            if (hasChildren) {
                item.setAttribute('aria-expanded', 'true');
                const group = document.createElement('ul');
                group.setAttribute('role', 'group');
                node.children.forEach(child => group.append(renderTreeItem(child)));
                item.append(group);

                row.querySelector('.xp-twisty').addEventListener('click', event => {
                    event.stopPropagation();
                    setExpanded(item, item.getAttribute('aria-expanded') !== 'true');
                });
                row.addEventListener('dblclick', () => {
                    setExpanded(item, item.getAttribute('aria-expanded') !== 'true');
                });
            }

            row.addEventListener('click', () => {
                navigate(node.id);
                item.focus();
            });

            treeItems.set(node.id, item);
            return item;
        }

        function setExpanded(item, expanded) {
            item.setAttribute('aria-expanded', String(expanded));
        }

        // Tree items a keyboard user can currently reach, in visual order
        function visibleTreeItems() {
            return Array.from(tree.querySelectorAll('[role="treeitem"]')).filter(item =>
                !item.closest('[hidden]') && !item.parentElement.closest('[aria-expanded="false"]'));
        }

        function parentItem(item) {
            return item.parentElement.closest('[role="treeitem"]');
        }

        // WAI-ARIA tree pattern, with selection following focus as in Explorer
        function onTreeKeydown(event) {
            const item = event.target.closest('[role="treeitem"]');
            if (!item) return;

            const items = visibleTreeItems();
            const index = items.indexOf(item);
            const expanded = item.getAttribute('aria-expanded');
            let next = null;

            switch (event.key) {
                case 'ArrowDown': next = items[index + 1]; break;
                case 'ArrowUp': next = items[index - 1]; break;
                case 'Home': next = items[0]; break;
                case 'End': next = items[items.length - 1]; break;
                case 'ArrowRight':
                    if (expanded === 'false') setExpanded(item, true);
                    else if (expanded === 'true') next = items[index + 1];
                    break;
                case 'ArrowLeft':
                    if (expanded === 'true') setExpanded(item, false);
                    else next = parentItem(item);
                    break;
                case 'Enter':
                case ' ':
                    navigate(item.dataset.node);
                    break;
                default:
                    return;
            }

            event.preventDefault();
            if (next) {
                next.focus();
                // Arrowing through the tree shouldn't flood the back button
                navigate(next.dataset.node, { replace: true });
            }
        }

        // -- Selection --

        function pathOf(node) {
            const labels = [];
            for (let n = node; n; n = n.parent) labels.unshift(n.label);
            return `C:\\${labels.join('\\')}`;
        }

        function visibleChildren(folder) {
            return folder.children.filter(child => !child.el.hidden);
        }

        function updateStatus() {
            contentsHeader.textContent = `Contents of '${current.label}'`;
            if (current.kind === 'folder') {
                statusCount.textContent = `${visibleChildren(current).length} object(s)`;
                statusDetail.textContent = current === root ? 'Newest first' : '';
            } else {
                statusCount.textContent = `${current.roles.length} object(s)`;
                statusDetail.textContent = `${formatSpan(current.start, current.end)} · ${formatTenure(current.start, current.end)}`;
            }
        }

        function select(id) {
            const role = roles.get(id);
            let node = role ? role.company : nodes.get(id);
            if (!node || node.el.hidden) node = root;
            current = node;

            nodes.forEach(n => n.el.classList.toggle('is-current', n === node));
            treeItems.forEach((item, nodeId) => {
                const selected = nodeId === node.id;
                item.setAttribute('aria-selected', String(selected));
                item.tabIndex = selected ? 0 : -1;
            });
            listingRows.forEach(row => row.classList.remove('is-selected'));

            // Reveal the selected folder in the tree
            for (let n = node.parent; n; n = n.parent) setExpanded(treeItems.get(n.id), true);

            addressField.textContent = pathOf(node);
            upButton.disabled = node === root;
            updateStatus();

            roles.forEach(r => r.el.classList.toggle('is-target', r === role));
            if (explorerLayout.matches) {
                if (role) role.el.scrollIntoView({ block: 'nearest' });
                else root.el.scrollTop = 0;
            }
        }

        function urlFor(id) {
            return id === root.id ? location.pathname + location.search : `#${id}`;
        }

        function navigate(id, { replace = false } = {}) {
            const url = urlFor(id);
            // Re-selecting what's already in the address bar shouldn't add history
            const unchanged = new URL(url, location.href).href === location.href;
            history[replace || unchanged ? 'replaceState' : 'pushState'](null, '', url);
            select(id);
        }

        function idFromHash() {
            return decodeURIComponent(location.hash.slice(1)) || root.id;
        }

        // -- Development-only filter --

        function applyFilter() {
            const devOnly = filterInput.checked;
            walk(root, node => {
                if (node.kind === 'company') node.el.hidden = devOnly && node.category !== 'development';
            });
            // Folders hide once everything in them is hidden (post-order: children first)
            (function hideEmptyFolders(folder) {
                folder.children.filter(child => child.kind === 'folder').forEach(hideEmptyFolders);
                if (folder !== root) folder.el.hidden = visibleChildren(folder).length === 0;
            })(root);

            nodes.forEach((node, id) => {
                if (node === root) return;
                treeItems.get(id).hidden = node.el.hidden;
                listingRows.get(id).hidden = node.el.hidden;
            });

            if (current.el.hidden) navigate(root.id, { replace: true });
            else updateStatus();
        }

        // -- Wire up --

        const contentsHeader = document.createElement('div');
        contentsHeader.className = 'xp-pane-header xp-contents-header';
        contentsHeader.setAttribute('aria-hidden', 'true');
        root.el.prepend(contentsHeader);

        renderListing(root);

        const tree = document.createElement('ul');
        tree.className = 'xp-tree';
        tree.setAttribute('role', 'tree');
        tree.setAttribute('aria-label', 'Experience folders');
        tree.append(renderTreeItem(root));
        tree.addEventListener('keydown', onTreeKeydown);
        treePane.append(tree);

        upButton.addEventListener('click', () => {
            if (current.parent) navigate(current.parent.id);
        });
        filterInput.addEventListener('change', applyFilter);
        window.addEventListener('hashchange', () => select(idFromHash()));

        toolbar.hidden = false;
        treePane.hidden = false;
        statusBar.hidden = false;
        windowEl.classList.add('xp-ready');

        select(idFromHash());

        // decrypt.js revealed the window only just now, after the browser had
        // already given up on scrolling to the #fragment. Redo it in the stacked
        // (phone) layout, where the page itself is what scrolls.
        if (location.hash && !explorerLayout.matches) {
            const target = document.getElementById(idFromHash());
            if (target) target.scrollIntoView();
        }
    }

    document.addEventListener('DOMContentLoaded', initExplorer);
})();
