// Global State
let currentView = 'builder'; // 'builder', 'dashboard', or 'invoices'

function getEmptyInvoice() {
    return {
        id: generateId(),
        status: 'draft',
        fromName: 'Freelance Studio',
        fromDetails: 'hello@studio.com',
        toName: 'Acme Corp',
        toDetails: '123 Business Rd.\nNew York, NY 10001',
        invoiceNumber: 'INV-' + Math.floor(Math.random() * 10000),
        date: new Date().toISOString().split('T')[0],
        taxRate: 0,
        notes: 'Payment is due within 15 days.',
        items: [
            { id: generateId(), desc: 'Web Design', qty: 1, price: 1500 }
        ]
    };
}

let invoiceData = getEmptyInvoice();
let savedInvoices = JSON.parse(localStorage.getItem('qi_invoices')) || [];
let chartInstance = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    refreshFormFromData();
    bindFormEvents();
    initChart();
    setupKeyboardShortcuts();

    // Initial renders
    updateDashboardStats();
    renderAllInvoicesList();
}

function refreshFormFromData() {
    document.getElementById('input-inv-date').value = invoiceData.date;
    document.getElementById('invoice-status').value = invoiceData.status;
    document.getElementById('input-from-name').value = invoiceData.fromName;
    document.getElementById('input-from-details').value = invoiceData.fromDetails;
    document.getElementById('input-to-name').value = invoiceData.toName;
    document.getElementById('input-to-details').value = invoiceData.toDetails;
    document.getElementById('input-inv-num').value = invoiceData.invoiceNumber;
    document.getElementById('input-tax').value = invoiceData.taxRate;
    document.getElementById('input-notes').value = invoiceData.notes;

    renderEditorItems();
    updatePreview();
    updateStatusStamp();
}

// --- Utility Functions ---
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// --- View Management ---
function switchView(view) {
    currentView = view;
    const views = ['dashboard', 'builder', 'invoices'];
    const navBtns = {
        'dashboard': document.getElementById('nav-dashboard-btn'),
        'invoices': document.getElementById('nav-invoices-btn')
    };

    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) {
            if (v === view) {
                el.classList.remove('hidden');
                if (v === 'builder') el.classList.add('flex');
            } else {
                el.classList.add('hidden');
                if (v === 'builder') el.classList.remove('flex');
            }
        }
    });

    Object.keys(navBtns).forEach(k => {
        const btn = navBtns[k];
        if (!btn) return;
        if (k === view) {
            btn.classList.add('text-emerald-600');
            btn.classList.remove('text-gray-600');
        } else {
            btn.classList.remove('text-emerald-600');
            btn.classList.add('text-gray-600');
        }
    });
}

// --- Persistence & Data Management ---
function saveCurrentInvoice() {
    const index = savedInvoices.findIndex(inv => inv.id === invoiceData.id);
    if (index >= 0) {
        savedInvoices[index] = { ...invoiceData };
    } else {
        savedInvoices.push({ ...invoiceData });
    }

    localStorage.setItem('qi_invoices', JSON.stringify(savedInvoices));

    const indicator = document.getElementById('save-indicator');
    if (indicator) {
        indicator.classList.remove('opacity-0');
        setTimeout(() => indicator.classList.add('opacity-0'), 2000);
    }

    updateDashboardStats();
    renderAllInvoicesList();
}

function createNewInvoice() {
    invoiceData = getEmptyInvoice();
    refreshFormFromData();
    switchView('builder');
}

function loadInvoice(id) {
    const inv = savedInvoices.find(i => i.id === id);
    if (inv) {
        invoiceData = { ...inv }; // clone
        refreshFormFromData();
        switchView('builder');
    }
}

function deleteInvoice(id) {
    if (confirm("Are you sure you want to delete this invoice?")) {
        savedInvoices = savedInvoices.filter(i => i.id !== id);
        localStorage.setItem('qi_invoices', JSON.stringify(savedInvoices));

        if (invoiceData.id === id) {
            createNewInvoice();
        } else {
            updateDashboardStats();
            renderAllInvoicesList();
        }
    }
}

function updateDashboardStats() {
    let totalPaid = 0;
    let totalPending = 0;
    let pendingCount = 0;

    const dashList = document.getElementById('dash-recent-list');
    const dashEmpty = document.getElementById('dash-recent-empty');
    if (dashList) dashList.innerHTML = '';

    // Sort descending by date
    const sorted = [...savedInvoices].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(inv => {
        const subtotal = inv.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
        const total = subtotal + (subtotal * (inv.taxRate / 100));

        if (inv.status === 'paid') {
            totalPaid += total;
        } else {
            totalPending += total;
            pendingCount++;
        }
    });

    const elPaid = document.getElementById('dash-total-paid');
    const elPending = document.getElementById('dash-total-pending');
    const elCount = document.getElementById('dash-pending-count');

    if (elPaid) elPaid.textContent = formatCurrency(totalPaid);
    if (elPending) elPending.textContent = formatCurrency(totalPending);
    if (elCount) elCount.textContent = pendingCount;

    // Render recent 5 on dash
    const top5 = sorted.slice(0, 5);
    if (top5.length === 0) {
        if (dashEmpty) dashEmpty.classList.remove('hidden');
    } else {
        if (dashEmpty) dashEmpty.classList.add('hidden');
        top5.forEach(inv => {
            const subtotal = inv.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
            const total = subtotal + (subtotal * (inv.taxRate / 100));

            let statusColor = 'bg-gray-100 text-gray-700';
            if (inv.status === 'paid') statusColor = 'bg-emerald-100 text-emerald-800';
            if (inv.status === 'sent') statusColor = 'bg-blue-100 text-blue-800';

            const dStr = new Date(inv.date);
            const formattedDate = !isNaN(dStr) ? dStr.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors cursor-pointer block sm:table-row cursor-pointer';
            tr.onclick = () => loadInvoice(inv.id);
            tr.innerHTML = `
                <td class="px-6 py-4 border-b border-gray-100 w-24">
                    <span class="px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${statusColor}">${inv.status}</span>
                </td>
                <td class="px-6 py-4 border-b border-gray-100 font-mono text-sm text-gray-900">${inv.invoiceNumber}</td>
                <td class="px-6 py-4 border-b border-gray-100 text-sm text-gray-600">${inv.toName}</td>
                <td class="px-6 py-4 border-b border-gray-100 text-sm text-gray-500 text-right">${formattedDate}</td>
            `;
            if (dashList) dashList.appendChild(tr);
        });
    }

    updateChart();
}

function updateChart() {
    if (!chartInstance) return;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const labels = [];
    const data = [0, 0, 0, 0, 0, 0];

    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        labels.push(monthNames[d.getMonth()]);
    }

    savedInvoices.forEach(inv => {
        if (inv.status === 'paid') {
            const invDate = new Date(inv.date);
            const monthsDiff = (today.getFullYear() - invDate.getFullYear()) * 12 + today.getMonth() - invDate.getMonth();
            if (monthsDiff >= 0 && monthsDiff < 6) {
                const subtotal = inv.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
                const total = subtotal + (subtotal * (inv.taxRate / 100));
                data[5 - monthsDiff] += total;
            }
        }
    });

    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.update();
}

function renderAllInvoicesList() {
    const list = document.getElementById('all-invoices-list');
    const empty = document.getElementById('all-invoices-empty');
    if (!list) return;
    list.innerHTML = '';

    const sorted = [...savedInvoices].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sorted.length === 0) {
        empty.classList.remove('hidden');
        empty.classList.add('flex');
    } else {
        empty.classList.add('hidden');
        empty.classList.remove('flex');

        sorted.forEach(inv => {
            const subtotal = inv.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
            const total = subtotal + (subtotal * (inv.taxRate / 100));

            let statusColor = 'bg-gray-100 text-gray-700';
            if (inv.status === 'paid') statusColor = 'bg-emerald-100 text-emerald-800';
            if (inv.status === 'sent') statusColor = 'bg-blue-100 text-blue-800';

            const dStr = new Date(inv.date);
            const formattedDate = !isNaN(dStr) ? dStr.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors';
            tr.innerHTML = `
                <td class="p-4 w-28">
                    <span class="px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${statusColor}">${inv.status}</span>
                </td>
                <td class="p-4 font-mono text-sm text-gray-900">${inv.invoiceNumber}</td>
                <td class="p-4 text-sm text-gray-800 font-medium">${inv.toName}</td>
                <td class="p-4 text-sm text-gray-500">${formattedDate}</td>
                <td class="p-4 text-right font-mono text-sm text-gray-900 font-medium">${formatCurrency(total)}</td>
                <td class="p-4 text-right">
                    <button class="text-gray-400 hover:text-emerald-600 transition-colors p-1" onclick="loadInvoice('${inv.id}')" title="Edit">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button class="text-gray-400 hover:text-red-600 transition-colors p-1 ml-1" onclick="deleteInvoice('${inv.id}')" title="Delete">
                        <i data-lucide="trash" class="w-4 h-4"></i>
                    </button>
                </td>
            `;
            list.appendChild(tr);
        });
    }
    lucide.createIcons();
}


// --- Chart Initialization ---
function initChart() {
    const ctx = document.getElementById('revenueChart').getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)'); // Emerald 500 semi-transparent
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Revenue',
                data: [],
                borderColor: '#059669', // Emerald 600
                backgroundColor: gradient,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#059669',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1f2937',
                    padding: 12,
                    titleFont: { family: 'Inter', size: 13 },
                    bodyFont: { family: 'JetBrains Mono', size: 14 }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Inter' } }
                },
                y: {
                    grid: { borderDash: [4, 4], color: '#f3f4f6' },
                    ticks: {
                        font: { family: 'JetBrains Mono' },
                        callback: function (value) { return '$' + value; }
                    }
                }
            }
        }
    });

    updateChart();
}

// --- Editor & Preview Logic ---
function bindFormEvents() {
    const inputs = ['from-name', 'from-details', 'to-name', 'to-details', 'inv-num', 'inv-date', 'tax', 'notes'];

    inputs.forEach(id => {
        document.getElementById(`input-${id}`).addEventListener('input', (e) => {
            // Update state
            const keyMap = {
                'from-name': 'fromName', 'from-details': 'fromDetails',
                'to-name': 'toName', 'to-details': 'toDetails',
                'inv-num': 'invoiceNumber', 'inv-date': 'date',
                'tax': 'taxRate', 'notes': 'notes'
            };

            let val = e.target.value;
            if (id === 'tax') val = parseFloat(val) || 0;

            invoiceData[keyMap[id]] = val;
            updatePreview();
        });
    });

    document.getElementById('btn-add-item').addEventListener('click', addItem);
}

function renderEditorItems() {
    const container = document.getElementById('items-container');
    container.innerHTML = '';

    invoiceData.items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'flex gap-2 items-start';
        row.innerHTML = `
            <div class="flex-1">
                <input type="text" class="form-input text-sm focus:border-emerald-500 w-full" value="${item.desc}" onchange="updateItem(${index}, 'desc', this.value)" placeholder="Description">
            </div>
            <div class="w-20">
                <input type="number" class="form-input text-sm text-center focus:border-emerald-500 w-full" value="${item.qty}" min="1" oninput="updateItem(${index}, 'qty', this.value)">
            </div>
            <div class="w-28 relative">
                <span class="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                <input type="number" class="form-input text-sm pl-6 focus:border-emerald-500 w-full" value="${item.price}" min="0" oninput="updateItem(${index}, 'price', this.value)">
            </div>
            <button type="button" class="mt-1 p-2 text-gray-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50" onclick="removeItem(${index})">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        `;
        container.appendChild(row);
    });
    // Re-initialize icons for newly added HTML
    lucide.createIcons();
}

function addItem() {
    invoiceData.items.push({ id: generateId(), desc: '', qty: 1, price: 0 });
    renderEditorItems();
    updatePreview();
}

function updateItem(index, field, value) {
    if (field === 'qty' || field === 'price') {
        value = parseFloat(value) || 0;
    }
    invoiceData.items[index][field] = value;
    updatePreview();
}

function removeItem(index) {
    invoiceData.items.splice(index, 1);
    renderEditorItems();
    updatePreview();
}

function handleStatusChange() {
    const select = document.getElementById('invoice-status');
    invoiceData.status = select.value;

    updateStatusStamp();

    // trigger confetti if paid
    if (invoiceData.status === 'paid') {
        triggerConfetti();
    }
}

function triggerConfetti() {
    var duration = 3 * 1000;
    var animationEnd = Date.now() + duration;
    var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    var interval = setInterval(function () {
        var timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        var particleCount = 50 * (timeLeft / duration);
        // since particles fall down, start a bit higher than random
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
}

function updateStatusStamp() {
    const stamp = document.getElementById('preview-status-stamp');
    if (invoiceData.status === 'draft') {
        stamp.style.opacity = '0';
        stamp.className = stamp.className.replace(/text-\w+-\d+/g, '').replace(/border-\w+-\d+/g, '');
    } else if (invoiceData.status === 'sent') {
        stamp.textContent = 'SENT';
        stamp.className = stamp.className.replace(/text-\w+-\d+/g, '').replace(/border-\w+-\d+/g, '') + ' text-blue-500/30 border-blue-500/30';
        stamp.style.opacity = '1';
    } else if (invoiceData.status === 'paid') {
        stamp.textContent = 'PAID';
        stamp.className = stamp.className.replace(/text-\w+-\d+/g, '').replace(/border-\w+-\d+/g, '') + ' text-emerald-500/30 border-emerald-500/30';
        stamp.style.opacity = '1';
    }
}

function updatePreview() {
    // Basic Details
    document.getElementById('preview-from-name').textContent = invoiceData.fromName || 'Business Name';
    document.getElementById('preview-from-details').textContent = invoiceData.fromDetails;
    document.getElementById('preview-to-name').textContent = invoiceData.toName || 'Client Name';
    document.getElementById('preview-to-details').textContent = invoiceData.toDetails;
    document.getElementById('preview-inv-num').textContent = invoiceData.invoiceNumber;

    // Date formatting
    const d = new Date(invoiceData.date);
    document.getElementById('preview-inv-date').textContent = !isNaN(d) ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

    // Notes
    document.getElementById('preview-notes').textContent = invoiceData.notes;

    // Items
    const tbody = document.getElementById('preview-items');
    tbody.innerHTML = '';

    let subtotal = 0;

    invoiceData.items.forEach(item => {
        const amount = item.qty * item.price;
        subtotal += amount;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-3 text-gray-800">${item.desc}</td>
            <td class="py-3 text-gray-600 text-center">${item.qty}</td>
            <td class="py-3 font-mono text-gray-600 text-right">${formatCurrency(item.price)}</td>
            <td class="py-3 font-mono text-gray-900 text-right font-medium">${formatCurrency(amount)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Totals
    const taxAmount = subtotal * (invoiceData.taxRate / 100);
    const total = subtotal + taxAmount;

    document.getElementById('preview-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('preview-tax-rate').textContent = invoiceData.taxRate;
    document.getElementById('preview-tax-amount').textContent = formatCurrency(taxAmount);
    document.getElementById('preview-total').textContent = formatCurrency(total);
}

// --- Command Palette Logic ---
let isPaletteOpen = false;

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            toggleCommandPalette();
        }
        if (e.key === 'Escape' && isPaletteOpen) {
            toggleCommandPalette();
        }
    });

    document.getElementById('command-palette-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'command-palette-overlay') {
            toggleCommandPalette();
        }
    });

    document.getElementById('command-input').addEventListener('input', handleCommandSearch);
}

function toggleCommandPalette(context = null) {
    const overlay = document.getElementById('command-palette-overlay');
    const modal = document.getElementById('command-palette-modal');
    const input = document.getElementById('command-input');

    isPaletteOpen = !isPaletteOpen;

    if (isPaletteOpen) {
        overlay.classList.remove('hidden');
        // trigger reflow
        void overlay.offsetWidth;
        overlay.classList.remove('opacity-0');
        modal.classList.remove('scale-95', 'opacity-0');

        if (context === 'item') {
            input.value = "Add item: ";
        } else if (context === 'client') {
            input.value = "Change client: ";
        } else {
            input.value = "";
        }

        handleCommandSearch(); // initial render
        setTimeout(() => input.focus(), 50);
    } else {
        overlay.classList.add('opacity-0');
        modal.classList.add('scale-95', 'opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 200);
    }
}

function handleCommandSearch() {
    const query = document.getElementById('command-input').value.toLowerCase();
    const resultsContainer = document.getElementById('command-results');

    // Mock data for display
    const actions = [
        { id: 'add_item', title: 'Add Line Item', subtitle: 'Type "Add item: [desc] [amount]"', icon: 'plus-square', action: () => forceAddItem(query) },
        { id: 'client_acme', title: 'Set Client: Acme Corp', subtitle: '123 Business Rd, NY', icon: 'user', action: () => setClient('Acme Corp', '123 Business Rd.\nNew York, NY 10001') },
        { id: 'client_stark', title: 'Set Client: Stark Ind.', subtitle: '200 Park Ave, NY', icon: 'user', action: () => setClient('Stark Industries', '200 Park Ave.\nNew York, NY 10166') },
        { id: 'mark_paid', title: 'Mark Invoice as Paid', subtitle: 'Update status globally', icon: 'check-circle', action: () => setStatus('paid') },
        { id: 'go_dash', title: 'Go to Dashboard', subtitle: 'View revenue charts', icon: 'layout-dashboard', action: () => { switchView('dashboard'); toggleCommandPalette(); } },
    ];

    const filtered = actions.filter(a => a.title.toLowerCase().includes(query) || a.subtitle.toLowerCase().includes(query) || query.startsWith('add item') || query.startsWith('change client'));

    resultsContainer.innerHTML = '';

    if (filtered.length === 0) {
        resultsContainer.innerHTML = `<div class="p-4 text-center text-gray-500 text-sm">No commands found.</div>`;
        return;
    }

    filtered.forEach((cmd, i) => {
        const div = document.createElement('div');
        div.className = `flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${i === 0 ? 'bg-gray-100' : 'hover:bg-gray-50'}`;
        div.onclick = cmd.action;
        div.innerHTML = `
            <div class="bg-white p-2 rounded border border-gray-200 text-gray-500">
                <i data-lucide="${cmd.icon}" class="w-4 h-4"></i>
            </div>
            <div class="flex-1 text-left">
                <div class="font-medium text-gray-900 text-sm">${cmd.title}</div>
                <div class="text-xs text-gray-500">${cmd.subtitle}</div>
            </div>
            <div class="text-xs text-gray-400">↵</div>
        `;
        resultsContainer.appendChild(div);
    });

    lucide.createIcons();
}

function setClient(name, address) {
    invoiceData.toName = name;
    invoiceData.toDetails = address;
    document.getElementById('input-to-name').value = name;
    document.getElementById('input-to-details').value = address;
    updatePreview();
    toggleCommandPalette();
}

function setStatus(status) {
    document.getElementById('invoice-status').value = status;
    handleStatusChange();
    toggleCommandPalette();
}

function forceAddItem(query) {
    // parse "Add item: Logo Design 500"
    let match = query.match(/add item:\s*(.*?)\s+(\d+)$/i);
    if (match) {
        let desc = match[1].trim();
        let price = parseFloat(match[2]);
        invoiceData.items.push({ id: generateId(), desc, qty: 1, price });
        renderEditorItems();
        updatePreview();
    } else {
        addItem();
    }
    toggleCommandPalette();
}

// --- Export Logic ---
function generateWhatsAppLink() {
    // 1. Trigger the download automatically so they have the file
    downloadPDF().then(() => {
        // 2. Open WhatsApp link with pre-filled text
        const total = document.getElementById('preview-total').textContent;
        const invNum = invoiceData.invoiceNumber;
        let message = `Hello ${invoiceData.toName},\n\nYour invoice ${invNum} for ${total} is ready. I have attached the PDF document to this message.\n\nThank you for your business!`;
        const encoded = encodeURIComponent(message);

        // Timeout to ensure download starts before navigating
        setTimeout(() => {
            alert("Your PDF is downloading! Please attach it to the WhatsApp message after it opens.");
            window.open(`https://wa.me/?text=${encoded}`, '_blank');
        }, 500);
    });
}

async function downloadPDF() {
    const btn = document.getElementById('btn-download');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Generating...`;
    lucide.createIcons();

    try {
        const preview = document.getElementById('invoice-preview-container');

        // Hide scrollbar and ensure it's fully visible for capture if needed
        const originalTransform = preview.style.transform;
        preview.style.transform = 'scale(1)';

        // Use html2canvas
        const canvas = await html2canvas(preview, {
            scale: 2, // Higher resolution
            useCORS: true,
            logging: false,
            windowWidth: preview.scrollWidth,
            windowHeight: preview.scrollHeight
        });

        // Restore transform
        preview.style.transform = originalTransform;

        const imgData = canvas.toDataURL('image/png');

        // Get jsPDF from window object
        window.jsPDF = window.jspdf.jsPDF;

        // Use jsPDF: portrait, padding, A4
        const pdf = new window.jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // A4 size: 210 x 297 mm
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${invoiceData.invoiceNumber}.pdf`);

    } catch (error) {
        console.error('PDF generation failed:', error);
        alert('Failed to generate PDF. Check console.');
    } finally {
        btn.innerHTML = originalText;
        lucide.createIcons();
    }
}
