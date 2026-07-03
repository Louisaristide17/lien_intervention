// ===== STATE =====
let clients = JSON.parse(localStorage.getItem('clients') || '[]');
let interventions = JSON.parse(localStorage.getItem('interventions') || '[]');
let currentIntervention = null;
let currentPdfBlob = null;
// Cachets indépendants par signataire
let cachets = { technicien: null, client: null, atelier: null };
let sigPads = {};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    initSignaturePads();
    renderDashboard();
    renderClientsList();
    renderInterventionsList();
    setDefaultDate();
    // Ouvrir tous les accordéons par défaut
    document.querySelectorAll('.accordion').forEach(a => a.classList.add('open'));
});

// ===== NAVIGATION =====
function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('screen-' + name).classList.add('active');
    const map = { dashboard: 0, clients: 1, interventions: 2, form: 2, pdf: 2 };
    const idx = map[name];
    if (idx !== undefined) document.querySelectorAll('.nav-btn')[idx]?.classList.add('active');
    window.scrollTo(0, 0);
    if (name === 'form') { resizeSignaturePads(); }
}

// ===== ACCORDION =====
function toggleAccordion(header) {
    const accordion = header.parentElement;
    accordion.classList.toggle('open');
}

// ===== TOAST =====
function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + type;
    t.style.display = 'block';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.display = 'none'; }, 3000);
}

// ===== CONFIRM DIALOG =====
let confirmCallback = null;
function showConfirm(title, msg, cb) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('modal-confirm').style.display = 'flex';
    confirmCallback = cb;
    document.getElementById('confirm-ok-btn').onclick = () => { closeConfirm(); if (confirmCallback) confirmCallback(); };
}
function closeConfirm() {
    document.getElementById('modal-confirm').style.display = 'none';
    confirmCallback = null;
}

// ===== CLIENTS =====
function openClientModal(id = null) {
    const form = document.getElementById('form-client');
    form.reset();
    document.getElementById('c-id').value = '';
    if (id) {
        const c = clients.find(x => x.id === id);
        if (!c) return;
        document.getElementById('modal-client-title').textContent = 'Modifier le client';
        document.getElementById('c-id').value = c.id;
        document.getElementById('c-nom').value = c.nom || '';
        document.getElementById('c-adresse').value = c.adresse || '';
        document.getElementById('c-ville').value = c.ville || '';
        document.getElementById('c-tel').value = c.tel || '';
        document.getElementById('c-contact').value = c.contact || '';
        document.getElementById('c-poste').value = c.poste || '';
    } else {
        document.getElementById('modal-client-title').textContent = 'Ajouter un client';
    }
    document.getElementById('modal-client').style.display = 'flex';
}

function closeClientModal() {
    document.getElementById('modal-client').style.display = 'none';
}

function saveClient(e) {
    e.preventDefault();
    const id = document.getElementById('c-id').value;
    const client = {
        id: id || Date.now().toString(),
        nom: document.getElementById('c-nom').value.trim(),
        adresse: document.getElementById('c-adresse').value.trim(),
        ville: document.getElementById('c-ville').value.trim(),
        tel: document.getElementById('c-tel').value.trim(),
        contact: document.getElementById('c-contact').value.trim(),
        poste: document.getElementById('c-poste').value.trim(),
    };
    if (id) {
        clients = clients.map(c => c.id === id ? client : c);
        showToast('Client modifié avec succès', 'success');
    } else {
        clients.push(client);
        showToast('Client ajouté avec succès', 'success');
    }
    saveData();
    closeClientModal();
    renderClientsList();
    renderDashboard();
}

function deleteClient(id) {
    showConfirm('Supprimer le client', 'Cette action est irréversible. Continuer ?', () => {
        clients = clients.filter(c => c.id !== id);
        saveData();
        renderClientsList();
        showToast('Client supprimé');
    });
}

function filterClients() {
    const q = document.getElementById('client-search').value.toLowerCase();
    renderClientsList(q);
}

function renderClientsList(filter = '') {
    const el = document.getElementById('clients-list');
    const filtered = clients.filter(c =>
        c.nom.toLowerCase().includes(filter) ||
        (c.ville || '').toLowerCase().includes(filter) ||
        (c.tel || '').toLowerCase().includes(filter)
    );
    if (!filtered.length) {
        el.innerHTML = '<p class="empty-msg">Aucun client trouvé.</p>';
        return;
    }
    el.innerHTML = filtered.map(c => `
        <div class="list-item">
            <div class="list-item-info">
                <h4>${escHtml(c.nom)}</h4>
                <p>${escHtml(c.ville || '')} ${c.tel ? '• ' + escHtml(c.tel) : ''} ${c.contact ? '• ' + escHtml(c.contact) : ''}</p>
            </div>
            <div class="list-item-actions">
                <button class="btn-icon" onclick="newIntervention('${c.id}')" title="Nouvelle intervention">📋</button>
                <button class="btn-icon" onclick="openClientModal('${c.id}')" title="Modifier">✏️</button>
                <button class="btn-icon" onclick="deleteClient('${c.id}')" title="Supprimer">🗑️</button>
            </div>
        </div>`).join('');
}

// ===== INTERVENTIONS =====
function newIntervention(clientId = null) {
    currentIntervention = null;
    resetForm();
    populateClientSelect();
    setDefaultDate();
    if (clientId) {
        document.getElementById('f-client').value = clientId;
        fillClientInfo();
    }
    generateNumero();
    showScreen('form');
}

function generateNumero() {
    const d = new Date();
    const num = `INT-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(interventions.length+1).padStart(3,'0')}`;
    document.getElementById('f-numero').value = num;
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const el = document.getElementById('f-date');
    if (el && !el.value) el.value = today;
}

function populateClientSelect() {
    const sel = document.getElementById('f-client');
    sel.innerHTML = '<option value="">-- Sélectionner un client --</option>';
    clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nom + (c.ville ? ' - ' + c.ville : '');
        sel.appendChild(opt);
    });
}

function fillClientInfo() {
    const id = document.getElementById('f-client').value;
    const box = document.getElementById('client-info-display');
    if (!id) { box.style.display = 'none'; return; }
    const c = clients.find(x => x.id === id);
    if (!c) { box.style.display = 'none'; return; }
    document.getElementById('ci-adresse').textContent = [c.adresse, c.ville].filter(Boolean).join(', ') || '-';
    document.getElementById('ci-tel').textContent = c.tel || '-';
    document.getElementById('ci-contact').textContent = [c.contact, c.poste].filter(Boolean).join(' / ') || '-';
    box.style.display = 'block';
}

function getCheckedValues(name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x => x.value);
}

function collectFormData() {
    return {
        id: currentIntervention?.id || Date.now().toString(),
        numero: document.getElementById('f-numero').value,
        clientId: document.getElementById('f-client').value,
        date: document.getElementById('f-date').value,
        technicien: document.getElementById('f-technicien').value.trim(),
        nature: getCheckedValues('nature'),
        origine: getCheckedValues('origine')[0] || '',
        materiel: {
            marque: document.getElementById('m-marque').value.trim(),
            modele: document.getElementById('m-modele').value.trim(),
            serie: document.getElementById('m-serie').value.trim(),
            parc: document.getElementById('m-parc').value.trim(),
            freq: document.getElementById('m-freq').value.trim(),
            accessoires: document.getElementById('m-accessoires').value.trim(),
            etat: getCheckedValues('etat'),
        },
        diagnostic: {
            problemes: getCheckedValues('pb_signale'),
            anomalies: getCheckedValues('anomalie'),
        },
        travaux: {
            entretien: getCheckedValues('entretien'),
            reparation: getCheckedValues('reparation'),
            obs: document.getElementById('f-travaux-obs').value.trim(),
        },
        resultat: getCheckedValues('resultat')[0] || '',
        suite: getCheckedValues('suite'),
        suiteObs: document.getElementById('f-suite-obs').value.trim(),
        observations: document.getElementById('f-observations').value.trim(),
        temps: {
            arrivee: document.getElementById('f-heure-arrivee').value,
            depart: document.getElementById('f-heure-depart').value,
            duree: document.getElementById('f-duree').value,
            km: document.getElementById('f-km').value,
            pieces: document.getElementById('f-pieces').value.trim(),
            cout: document.getElementById('f-cout').value,
        },
        signatures: {
            technicien: sigPads.technicien && !sigPads.technicien.isEmpty() ? sigPads.technicien.toDataURL() : null,
            client: sigPads.client && !sigPads.client.isEmpty() ? sigPads.client.toDataURL() : null,
            atelier: sigPads.atelier && !sigPads.atelier.isEmpty() ? sigPads.atelier.toDataURL() : null,
        },
        cachets: {
            technicien: cachets.technicien,
            client: cachets.client,
            atelier: cachets.atelier,
        },
        cachet: cachets.technicien || cachets.atelier || null, // compat ancien code
        status: 'draft',
        updatedAt: new Date().toISOString(),
    };
}

function saveDraft() {
    const data = collectFormData();
    data.status = 'draft';
    if (currentIntervention) {
        interventions = interventions.map(i => i.id === data.id ? data : i);
    } else {
        interventions.unshift(data);
        currentIntervention = data;
    }
    saveData();
    renderInterventionsList();
    renderDashboard();
    showToast('Brouillon sauvegardé 💾', 'success');
}

function renderInterventionsList() {
    const el = document.getElementById('interventions-list');
    if (!interventions.length) {
        el.innerHTML = '<p class="empty-msg">Aucune intervention enregistrée.</p>';
        return;
    }
    el.innerHTML = interventions.map(i => {
        const c = clients.find(x => x.id === i.clientId);
        const statusClass = { draft: 'badge-draft', done: 'badge-done', sent: 'badge-sent' }[i.status] || 'badge-draft';
        const statusLabel = { draft: '⏳ Brouillon', done: '✅ Terminé', sent: '📤 Envoyé' }[i.status] || 'Brouillon';
        return `<div class="list-item">
            <div class="list-item-info">
                <h4>${escHtml(i.numero || 'Sans N°')} — ${escHtml(c?.nom || 'Client inconnu')}</h4>
                <p>${escHtml(i.date || '')} ${i.technicien ? '• ' + escHtml(i.technicien) : ''} &nbsp;<span class="badge ${statusClass}">${statusLabel}</span></p>
            </div>
            <div class="list-item-actions">
                <button class="btn-icon" onclick="editIntervention('${i.id}')" title="Modifier">✏️</button>
                <button class="btn-icon" onclick="deleteIntervention('${i.id}')" title="Supprimer">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

function editIntervention(id) {
    const data = interventions.find(i => i.id === id);
    if (!data) return;
    currentIntervention = data;
    resetForm();
    populateClientSelect();
    // Remplir les champs
    document.getElementById('f-numero').value = data.numero || '';
    document.getElementById('f-client').value = data.clientId || '';
    document.getElementById('f-date').value = data.date || '';
    document.getElementById('f-technicien').value = data.technicien || '';
    fillClientInfo();
    // Checkboxes
    setCheckboxes('nature', data.nature || []);
    setRadio('origine', data.origine);
    const m = data.materiel || {};
    document.getElementById('m-marque').value = m.marque || '';
    document.getElementById('m-modele').value = m.modele || '';
    document.getElementById('m-serie').value = m.serie || '';
    document.getElementById('m-parc').value = m.parc || '';
    document.getElementById('m-freq').value = m.freq || '';
    document.getElementById('m-accessoires').value = m.accessoires || '';
    setCheckboxes('etat', m.etat || []);
    setCheckboxes('pb_signale', (data.diagnostic || {}).problemes || []);
    setCheckboxes('anomalie', (data.diagnostic || {}).anomalies || []);
    setCheckboxes('entretien', (data.travaux || {}).entretien || []);
    setCheckboxes('reparation', (data.travaux || {}).reparation || []);
    document.getElementById('f-travaux-obs').value = (data.travaux || {}).obs || '';
    setRadio('resultat', data.resultat);
    setCheckboxes('suite', data.suite || []);
    document.getElementById('f-suite-obs').value = data.suiteObs || '';
    document.getElementById('f-observations').value = data.observations || '';
    const t = data.temps || {};
    document.getElementById('f-heure-arrivee').value = t.arrivee || '';
    document.getElementById('f-heure-depart').value = t.depart || '';
    document.getElementById('f-duree').value = t.duree || '';
    document.getElementById('f-km').value = t.km || '';
    document.getElementById('f-pieces').value = t.pieces || '';
    document.getElementById('f-cout').value = t.cout || '';
    // Signatures
    setTimeout(() => {
        if (data.signatures?.technicien) sigPads.technicien?.fromDataURL(data.signatures.technicien);
        if (data.signatures?.client) sigPads.client?.fromDataURL(data.signatures.client);
        if (data.signatures?.atelier) sigPads.atelier?.fromDataURL(data.signatures.atelier);
    }, 200);
    // Cachets
    const savedCachets = data.cachets || {};
    ['technicien', 'client', 'atelier'].forEach(k => {
        if (savedCachets[k]) {
            cachets[k] = savedCachets[k];
            showCachetPreviewFor(k, savedCachets[k]);
        }
    });
    showScreen('form');
}

function deleteIntervention(id) {
    showConfirm('Supprimer l\'intervention', 'Cette action est irréversible. Continuer ?', () => {
        interventions = interventions.filter(i => i.id !== id);
        saveData();
        renderInterventionsList();
        renderDashboard();
        showToast('Intervention supprimée');
    });
}

// ===== DASHBOARD =====
function renderDashboard() {
    const el = document.getElementById('recent-list');
    const recent = interventions.slice(0, 5);
    if (!recent.length) {
        el.innerHTML = '<p class="empty-msg">Aucune intervention pour le moment.</p>';
        return;
    }
    el.innerHTML = recent.map(i => {
        const c = clients.find(x => x.id === i.clientId);
        const statusLabel = { draft: '⏳ Brouillon', done: '✅ Terminé', sent: '📤 Envoyé' }[i.status] || 'Brouillon';
        const statusClass = { draft: 'badge-draft', done: 'badge-done', sent: 'badge-sent' }[i.status] || 'badge-draft';
        return `<div class="list-item" onclick="editIntervention('${i.id}')" style="cursor:pointer">
            <div class="list-item-info">
                <h4>${escHtml(i.numero || 'Sans N°')} — ${escHtml(c?.nom || 'Client inconnu')}</h4>
                <p>${escHtml(i.date || '')} ${i.technicien ? '• ' + escHtml(i.technicien) : ''} &nbsp;<span class="badge ${statusClass}">${statusLabel}</span></p>
            </div>
            <span style="color:#aaa">›</span>
        </div>`;
    }).join('');
}

// ===== SIGNATURES =====
function initSignaturePads() {
    ['technicien', 'client', 'atelier'].forEach(key => {
        const canvas = document.getElementById('sig-' + key);
        if (canvas) {
            sigPads[key] = new SignaturePad(canvas, {
                backgroundColor: 'rgb(250,250,250)',
                penColor: '#1C2331',
                minWidth: 1, maxWidth: 2.5,
            });
        }
    });
}

function resizeSignaturePads() {
    ['technicien', 'client', 'atelier'].forEach(key => {
        const canvas = document.getElementById('sig-' + key);
        if (!canvas || !sigPads[key]) return;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const data = sigPads[key].isEmpty() ? null : sigPads[key].toData();
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d').scale(ratio, ratio);
        sigPads[key].clear();
        if (data) sigPads[key].fromData(data);
    });
}

function clearSig(key) {
    if (sigPads[key]) sigPads[key].clear();
}

// ===== CAMÉRA CACHET =====
let cameraStream = null;
let cameraKey = null;        // 'technicien' | 'client' | 'atelier'
let cameraFacing = 'environment'; // 'environment' = arrière (mieux pour doc), 'user' = avant
let capturedDataUrl = null;

async function openCamera(key) {
    cameraKey = key;
    capturedDataUrl = null;
    const labels = { technicien: 'Technicien', client: 'Responsable Client', atelier: 'Responsable Atelier' };
    document.getElementById('camera-title').textContent = `📷 Cachet — ${labels[key]}`;

    // Reset UI
    document.getElementById('camera-viewfinder').style.display = 'block';
    document.getElementById('camera-preview-zone').style.display = 'none';
    document.getElementById('btn-capture').style.display = 'inline-block';
    document.getElementById('btn-validate').style.display = 'none';
    document.getElementById('btn-retake').style.display = 'none';
    document.getElementById('camera-switch-row').style.display = 'flex';
    document.getElementById('modal-camera').style.display = 'flex';

    await startStream();
}

async function startStream() {
    stopStream(); // arrêter l'ancien flux
    const video = document.getElementById('camera-video');
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: cameraFacing },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        });
        video.srcObject = cameraStream;
    } catch (err) {
        // Accès refusé ou pas de caméra — fallback fichier
        console.warn('Caméra inaccessible :', err);
        closeCamera();
        fallbackFileInput(cameraKey);
    }
}

function stopStream() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    const video = document.getElementById('camera-video');
    video.srcObject = null;
}

async function switchCamera() {
    cameraFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    await startStream();
}

function capturePhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    // Dimensions réelles de la vidéo
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Amélioration automatique : contraste + luminosité pour une photo sur fond blanc
    applyStampEnhancement(ctx, canvas.width, canvas.height);

    capturedDataUrl = canvas.toDataURL('image/png');

    // Passer en mode aperçu
    stopStream();
    document.getElementById('camera-viewfinder').style.display = 'none';
    document.getElementById('camera-preview-zone').style.display = 'flex';
    document.getElementById('camera-switch-row').style.display = 'none';
    document.getElementById('btn-capture').style.display = 'none';
    document.getElementById('btn-retake').style.display = 'inline-block';
    document.getElementById('btn-validate').style.display = 'inline-block';
}

// Amélioration image : augmente le contraste pour rendre le cachet bien lisible
function applyStampEnhancement(ctx, w, h) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    // Augmenter contraste + clarifier le fond blanc
    const contrast = 1.6;
    const brightness = 15;
    for (let i = 0; i < data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
            let val = data[i + c];
            // Brightness
            val += brightness;
            // Contrast : (val - 128) * factor + 128
            val = (val - 128) * contrast + 128;
            data[i + c] = Math.max(0, Math.min(255, val));
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

async function retakePhoto() {
    capturedDataUrl = null;
    document.getElementById('camera-viewfinder').style.display = 'block';
    document.getElementById('camera-preview-zone').style.display = 'none';
    document.getElementById('camera-switch-row').style.display = 'flex';
    document.getElementById('btn-capture').style.display = 'inline-block';
    document.getElementById('btn-retake').style.display = 'none';
    document.getElementById('btn-validate').style.display = 'none';
    await startStream();
}

function validatePhoto() {
    if (!capturedDataUrl || !cameraKey) return;
    cachets[cameraKey] = capturedDataUrl;
    showCachetPreviewFor(cameraKey, capturedDataUrl);
    closeCamera();
    showToast('Cachet enregistré ✅', 'success');
}

function closeCamera() {
    stopStream();
    document.getElementById('modal-camera').style.display = 'none';
    cameraKey = null;
    capturedDataUrl = null;
}

// Fallback : ouvrir un sélecteur de fichier si la caméra est refusée
function fallbackFileInput(key) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => loadCachetFor(e, key);
    input.click();
    showToast('Caméra non disponible — sélectionnez une image', '');
}

function showCachetPreviewFor(key, src) {
    const box = document.getElementById('cachet-preview-' + key);
    const img = document.getElementById('cachet-img-' + key);
    const empty = document.getElementById('cachet-empty-' + key);
    img.src = src;
    box.style.display = 'flex';
    if (empty) empty.style.display = 'none';
}

function clearCachet(key) {
    cachets[key] = null;
    const box = document.getElementById('cachet-preview-' + key);
    const empty = document.getElementById('cachet-empty-' + key);
    const input = document.getElementById('cachet-file-' + key);
    box.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    if (input) input.value = '';
}

// ===== FORM UTILS =====
function resetForm() {
    document.querySelectorAll('#screen-form input[type=text], #screen-form input[type=number], #screen-form input[type=date], #screen-form input[type=time], #screen-form input[type=tel], #screen-form textarea').forEach(el => el.value = '');
    document.querySelectorAll('#screen-form input[type=checkbox], #screen-form input[type=radio]').forEach(el => el.checked = false);
    document.getElementById('f-client').value = '';
    document.getElementById('client-info-display').style.display = 'none';
    ['technicien', 'client', 'atelier'].forEach(k => {
        sigPads[k]?.clear();
        clearCachet(k);
    });
}

function setCheckboxes(name, values) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(el => {
        el.checked = values.includes(el.value);
    });
}

function setRadio(name, value) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(el => {
        el.checked = el.value === value;
    });
}

// ===== SAVE / LOAD =====
function saveData() {
    localStorage.setItem('clients', JSON.stringify(clients));
    localStorage.setItem('interventions', JSON.stringify(interventions));
}

// ===== UTILS =====
function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getClientById(id) {
    return clients.find(c => c.id === id) || {};
}

// ===== GÉNÉRATION PDF =====
function generatePDF() {
    const data = collectFormData();
    // Sauvegarder l'intervention
    data.status = 'done';
    if (currentIntervention) {
        interventions = interventions.map(i => i.id === data.id ? data : i);
    } else {
        interventions.unshift(data);
        currentIntervention = data;
    }
    saveData();
    renderInterventionsList();
    renderDashboard();

    const client = getClientById(data.clientId);
    const zone = document.getElementById('pdf-render-zone');
    zone.innerHTML = buildPDFContent(data, client);

    showToast('Génération du PDF en cours...', '');

    setTimeout(() => {
        html2canvas(zone, { scale: 1.5, useCORS: true, backgroundColor: '#fff' }).then(canvas => {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const imgW = pageW;
            const imgH = (canvas.height * pageW) / canvas.width;
            let y = 0;
            let remainH = imgH;
            let first = true;
            while (remainH > 0) {
                if (!first) pdf.addPage();
                const sliceH = Math.min(pageH, remainH);
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = canvas.width;
                sliceCanvas.height = (sliceH / imgH) * canvas.height;
                const ctx = sliceCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, -(y / imgH) * canvas.height);
                const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
                pdf.addImage(imgData, 'JPEG', 0, 0, imgW, sliceH);
                y += pageH;
                remainH -= pageH;
                first = false;
            }
            // Stocker le pdf blob
            const pdfBlob = pdf.output('blob');
            currentPdfBlob = pdfBlob;
            // Afficher preview
            const reader = new FileReader();
            reader.onload = () => {
                document.getElementById('pdf-content-render').innerHTML = buildPDFContent(data, client);
                showScreen('pdf');
                showToast('PDF généré avec succès ✅', 'success');
            };
            reader.readAsDataURL(pdfBlob);
            // Sauvegarder le blob pour téléchargement
            window._lastPdf = { pdf, filename: `${data.numero || 'intervention'}.pdf` };
        }).catch(err => {
            console.error(err);
            showToast('Erreur lors de la génération PDF', 'error');
        });
    }, 300);
}

function buildPDFContent(data, client) {
    const checkIcon = (checked) => checked ? '☑' : '☐';
    const checklist = (values, allValues) => allValues.map(v =>
        `<span style="margin-right:12px">${checkIcon(values.includes(v))} ${escHtml(v)}</span>`
    ).join('');

    const natureAll = ['Maintenance préventive','Maintenance corrective','Installation','Mise en service','Formation','Autre'];
    const origineAll = ['Contrat','Demande client','Garantie','Urgence','Visite programmée'];
    const etatAll = ['Bon état général','Traces de chocs','Corrosion','Écran endommagé','Boutons défectueux','Batterie gonflée','Antenne cassée','Connecteurs oxydés'];
    const pbAll = ['Pas de communication','Mauvaise qualité audio','Portée insuffisante','Ne s\'allume pas','Batterie faible','Touche bloquée','Interférence','Affichage défaillant'];
    const anoAll = ['Circuit électronique défectueux','Condensateur HS','Antenne endommagée','Connecteur corrodé','Batterie défaillante','Firmware obsolète','Programmation incorrecte','Micro / Haut-parleur HS'];
    const entAll = ['Nettoyage complet','Vérification programmation','Mise à jour firmware','Contrôle fréquence','Test batterie','Vérification accessoires'];
    const repAll = ['Remplacement batterie','Remplacement antenne','Reprogrammation','Soudure / carte','Remplacement micro/HP','Remplacement connecteur'];
    const resAll = ['Matériel réparé','Réparation partielle','Non réparable','En attente pièces','Retour atelier'];
    const suiteAll = ['Remettre en service','Devis complémentaire','2ème visite prévue','Remplacement matériel','Contrat de maintenance'];
    const m = data.materiel || {};
    const diag = data.diagnostic || {};
    const trav = data.travaux || {};
    const temps = data.temps || {};
    const sigs = data.signatures || {};

    return `<div style="font-family:Arial,sans-serif;font-size:11px;color:#111;padding:20px;max-width:794px;margin:0 auto">
        <!-- HEADER -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1565C0;padding-bottom:12px;margin-bottom:14px">
            <div>
                <h1 style="font-size:18px;color:#1565C0;margin:0">🔧 FICHE D'INTERVENTION</h1>
                <p style="margin:4px 0;color:#555">Maintenance Talkie-Walkie / Radiocommunication</p>
            </div>
            <div style="text-align:right">
                <div style="font-size:13px;font-weight:700">N° ${escHtml(data.numero || '-')}</div>
                <div style="color:#555">Date : ${escHtml(data.date || '-')}</div>
                <div style="color:#555">Technicien : ${escHtml(data.technicien || '-')}</div>
            </div>
        </div>
        <!-- CLIENT -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
            <tr><th colspan="2" style="background:#1565C0;color:white;padding:6px 10px;text-align:left">INFORMATIONS CLIENT</th></tr>
            <tr>
                <td style="padding:5px 8px;border:1px solid #ccc;width:50%"><strong>Client :</strong> ${escHtml(client.nom || '-')}</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Contact :</strong> ${escHtml(client.contact || '-')} ${client.poste ? '(' + escHtml(client.poste) + ')' : ''}</td>
            </tr>
            <tr>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Adresse :</strong> ${escHtml([client.adresse, client.ville].filter(Boolean).join(', ') || '-')}</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Téléphone :</strong> ${escHtml(client.tel || '-')}</td>
            </tr>
        </table>
        <!-- TYPE INTERVENTION -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
            <tr><th colspan="2" style="background:#1565C0;color:white;padding:6px 10px;text-align:left">TYPE D'INTERVENTION</th></tr>
            <tr>
                <td style="padding:8px;border:1px solid #ccc;width:60%"><strong>Nature :</strong><br>${checklist(data.nature||[], natureAll)}</td>
                <td style="padding:8px;border:1px solid #ccc"><strong>Origine :</strong><br>${checklist([data.origine], origineAll)}</td>
            </tr>
        </table>
        <!-- MATERIEL -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
            <tr><th colspan="3" style="background:#1565C0;color:white;padding:6px 10px;text-align:left">IDENTIFICATION DU MATÉRIEL</th></tr>
            <tr>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Marque :</strong> ${escHtml(m.marque||'-')}</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Modèle :</strong> ${escHtml(m.modele||'-')}</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>N° Série :</strong> ${escHtml(m.serie||'-')}</td>
            </tr>
            <tr>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>N° Parc :</strong> ${escHtml(m.parc||'-')}</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Fréquence :</strong> ${escHtml(m.freq||'-')}</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Accessoires :</strong> ${escHtml(m.accessoires||'-')}</td>
            </tr>
            <tr><td colspan="3" style="padding:8px;border:1px solid #ccc"><strong>État visuel :</strong> ${checklist(m.etat||[], etatAll)}</td></tr>
        </table>`;
}

// Suite buildPDFContent (diagnostic, travaux, résultat, temps, signatures)
const _origBuild = buildPDFContent;
// On réécrit en ajoutant le reste dans une fonction séparée
function buildPDFRest(data, client) {
    const checkIcon = (checked) => checked ? '☑' : '☐';
    const checklist = (values, allValues) => allValues.map(v =>
        `<span style="margin-right:12px">${checkIcon(values.includes(v))} ${escHtml(v)}</span>`
    ).join('');
    const pbAll = ['Pas de communication','Mauvaise qualité audio','Portée insuffisante','Ne s\'allume pas','Batterie faible','Touche bloquée','Interférence','Affichage défaillant'];
    const anoAll = ['Circuit électronique défectueux','Condensateur HS','Antenne endommagée','Connecteur corrodé','Batterie défaillante','Firmware obsolète','Programmation incorrecte','Micro / Haut-parleur HS'];
    const entAll = ['Nettoyage complet','Vérification programmation','Mise à jour firmware','Contrôle fréquence','Test batterie','Vérification accessoires'];
    const repAll = ['Remplacement batterie','Remplacement antenne','Reprogrammation','Soudure / carte','Remplacement micro/HP','Remplacement connecteur'];
    const resAll = ['Matériel réparé','Réparation partielle','Non réparable','En attente pièces','Retour atelier'];
    const suiteAll = ['Remettre en service','Devis complémentaire','2ème visite prévue','Remplacement matériel','Contrat de maintenance'];
    const diag = data.diagnostic || {};
    const trav = data.travaux || {};
    const temps = data.temps || {};
    const sigs = data.signatures || {};

    return `
        <!-- DIAGNOSTIC -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
            <tr><th colspan="2" style="background:#1565C0;color:white;padding:6px 10px;text-align:left">DIAGNOSTIC</th></tr>
            <tr>
                <td style="padding:8px;border:1px solid #ccc;width:50%;vertical-align:top"><strong>Problèmes signalés :</strong><br>${checklist(diag.problemes||[], pbAll)}</td>
                <td style="padding:8px;border:1px solid #ccc;vertical-align:top"><strong>Anomalies constatées :</strong><br>${checklist(diag.anomalies||[], anoAll)}</td>
            </tr>
        </table>
        <!-- TRAVAUX -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
            <tr><th colspan="2" style="background:#1565C0;color:white;padding:6px 10px;text-align:left">TRAVAUX EFFECTUÉS</th></tr>
            <tr>
                <td style="padding:8px;border:1px solid #ccc;vertical-align:top"><strong>Entretien :</strong><br>${checklist(trav.entretien||[], entAll)}</td>
                <td style="padding:8px;border:1px solid #ccc;vertical-align:top"><strong>Réparations :</strong><br>${checklist(trav.reparation||[], repAll)}</td>
            </tr>
            <tr><td colspan="2" style="padding:6px 8px;border:1px solid #ccc"><strong>Observations :</strong> ${escHtml(trav.obs||'')}</td></tr>
        </table>
        <!-- RESULTAT -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
            <tr><th colspan="2" style="background:#1565C0;color:white;padding:6px 10px;text-align:left">RÉSULTAT &amp; SUITE</th></tr>
            <tr>
                <td style="padding:8px;border:1px solid #ccc;vertical-align:top"><strong>Résultat :</strong><br>${checklist([data.resultat], resAll)}</td>
                <td style="padding:8px;border:1px solid #ccc;vertical-align:top"><strong>Suite :</strong><br>${checklist(data.suite||[], suiteAll)}</td>
            </tr>
            <tr><td colspan="2" style="padding:6px 8px;border:1px solid #ccc"><strong>Observations technicien :</strong> ${escHtml(data.observations||'')}</td></tr>
        </table>
        <!-- TEMPS -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
            <tr><th colspan="4" style="background:#1565C0;color:white;padding:6px 10px;text-align:left">RÉCAPITULATIF TEMPS &amp; DÉPLACEMENT</th></tr>
            <tr>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Arrivée :</strong> ${escHtml(temps.arrivee||'-')}</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Départ :</strong> ${escHtml(temps.depart||'-')}</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Durée :</strong> ${escHtml(temps.duree||'-')} h</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Km :</strong> ${escHtml(temps.km||'-')}</td>
            </tr>
            <tr>
                <td colspan="2" style="padding:5px 8px;border:1px solid #ccc"><strong>Pièces :</strong> ${escHtml(temps.pieces||'-')}</td>
                <td colspan="2" style="padding:5px 8px;border:1px solid #ccc"><strong>Coût :</strong> ${escHtml(temps.cout||'-')} €</td>
            </tr>
        </table>
        <!-- SIGNATURES -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
            <tr><th colspan="3" style="background:#1565C0;color:white;padding:6px 10px;text-align:left">SIGNATURES &amp; CACHETS</th></tr>
            <tr>
                <td style="padding:8px;border:1px solid #ccc;text-align:center;width:33%">
                    <strong>Technicien</strong><br>
                    ${sigs.technicien ? `<img src="${sigs.technicien}" style="max-width:160px;max-height:60px;margin-top:6px;display:block;margin-left:auto;margin-right:auto">` : '<div style="height:60px;border:1px dashed #ccc;margin-top:6px"></div>'}
                    ${(data.cachets?.technicien) ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #ddd"><img src="${data.cachets.technicien}" style="max-width:140px;max-height:50px;display:block;margin:0 auto"></div>` : ''}
                </td>
                <td style="padding:8px;border:1px solid #ccc;text-align:center;width:33%">
                    <strong>Responsable Client</strong><br>
                    ${sigs.client ? `<img src="${sigs.client}" style="max-width:160px;max-height:60px;margin-top:6px;display:block;margin-left:auto;margin-right:auto">` : '<div style="height:60px;border:1px dashed #ccc;margin-top:6px"></div>'}
                    ${(data.cachets?.client) ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #ddd"><img src="${data.cachets.client}" style="max-width:140px;max-height:50px;display:block;margin:0 auto"></div>` : ''}
                </td>
                <td style="padding:8px;border:1px solid #ccc;text-align:center;width:33%">
                    <strong>Responsable Atelier</strong><br>
                    ${sigs.atelier ? `<img src="${sigs.atelier}" style="max-width:160px;max-height:60px;margin-top:6px;display:block;margin-left:auto;margin-right:auto">` : '<div style="height:60px;border:1px dashed #ccc;margin-top:6px"></div>'}
                    ${(data.cachets?.atelier) ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #ddd"><img src="${data.cachets.atelier}" style="max-width:140px;max-height:50px;display:block;margin:0 auto"></div>` : ''}
                </td>
            </tr>
        </table>
        <p style="text-align:center;color:#888;font-size:9px;margin-top:12px">Généré par TechIntervention • ${new Date().toLocaleDateString('fr-FR')}</p>
    </div>`;
}

// Reconstruire buildPDFContent en incluant la suite
function buildPDFContent(data, client) {
    const checkIcon = (checked) => checked ? '☑' : '☐';
    const checklist = (values, allValues) => allValues.map(v =>
        `<span style="margin-right:12px">${checkIcon(values.includes(v))} ${escHtml(v)}</span>`
    ).join('');
    const natureAll = ['Maintenance préventive','Maintenance corrective','Installation','Mise en service','Formation','Autre'];
    const origineAll = ['Contrat','Demande client','Garantie','Urgence','Visite programmée'];
    const etatAll = ['Bon état général','Traces de chocs','Corrosion','Écran endommagé','Boutons défectueux','Batterie gonflée','Antenne cassée','Connecteurs oxydés'];
    const m = data.materiel || {};

    const header = `<div style="font-family:Arial,sans-serif;font-size:11px;color:#111;padding:20px;max-width:794px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1565C0;padding-bottom:12px;margin-bottom:14px">
            <div><h1 style="font-size:18px;color:#1565C0;margin:0">🔧 FICHE D'INTERVENTION</h1>
            <p style="margin:4px 0;color:#555">Maintenance Talkie-Walkie / Radiocommunication</p></div>
            <div style="text-align:right">
                <div style="font-size:13px;font-weight:700">N° ${escHtml(data.numero||'-')}</div>
                <div style="color:#555">Date : ${escHtml(data.date||'-')}</div>
                <div style="color:#555">Technicien : ${escHtml(data.technicien||'-')}</div>
            </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
            <tr><th colspan="2" style="background:#1565C0;color:white;padding:6px 10px;text-align:left">INFORMATIONS CLIENT</th></tr>
            <tr>
                <td style="padding:5px 8px;border:1px solid #ccc;width:50%"><strong>Client :</strong> ${escHtml(client.nom||'-')}</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Contact :</strong> ${escHtml(client.contact||'-')}</td>
            </tr>
            <tr>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Adresse :</strong> ${escHtml([client.adresse,client.ville].filter(Boolean).join(', ')||'-')}</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Tél :</strong> ${escHtml(client.tel||'-')}</td>
            </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
            <tr><th colspan="2" style="background:#1565C0;color:white;padding:6px 10px;text-align:left">TYPE D'INTERVENTION</th></tr>
            <tr>
                <td style="padding:8px;border:1px solid #ccc;width:60%"><strong>Nature :</strong><br>${checklist(data.nature||[], natureAll)}</td>
                <td style="padding:8px;border:1px solid #ccc"><strong>Origine :</strong><br>${checklist([data.origine], origineAll)}</td>
            </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
            <tr><th colspan="3" style="background:#1565C0;color:white;padding:6px 10px;text-align:left">IDENTIFICATION DU MATÉRIEL</th></tr>
            <tr>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Marque :</strong> ${escHtml(m.marque||'-')}</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Modèle :</strong> ${escHtml(m.modele||'-')}</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>N° Série :</strong> ${escHtml(m.serie||'-')}</td>
            </tr>
            <tr>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>N° Parc :</strong> ${escHtml(m.parc||'-')}</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Fréquence :</strong> ${escHtml(m.freq||'-')}</td>
                <td style="padding:5px 8px;border:1px solid #ccc"><strong>Accessoires :</strong> ${escHtml(m.accessoires||'-')}</td>
            </tr>
            <tr><td colspan="3" style="padding:8px;border:1px solid #ccc"><strong>État visuel :</strong> ${checklist(m.etat||[], etatAll)}</td></tr>
        </table>`;

    return header + buildPDFRest(data, client);
}

// ===== TÉLÉCHARGEMENT & PARTAGE =====
function downloadPDF() {
    if (!window._lastPdf) { showToast('Veuillez d\'abord générer le PDF', 'error'); return; }
    window._lastPdf.pdf.save(window._lastPdf.filename);
    // Marquer comme envoyé
    if (currentIntervention) {
        interventions = interventions.map(i => i.id === currentIntervention.id ? { ...i, status: 'sent' } : i);
        saveData();
        renderDashboard();
        renderInterventionsList();
    }
    showToast('PDF téléchargé ✅', 'success');
}

function sendByEmail() {
    if (!currentIntervention) { showToast('Aucune intervention sélectionnée', 'error'); return; }
    const client = getClientById(currentIntervention.clientId);
    const subject = encodeURIComponent(`Fiche d'intervention ${currentIntervention.numero || ''} - ${client.nom || ''}`);
    const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint la fiche d'intervention n° ${currentIntervention.numero || ''} effectuée le ${currentIntervention.date || ''} chez ${client.nom || ''}.\n\nCordialement,\n${currentIntervention.technicien || 'Le Technicien'}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    showToast('Client mail ouvert', 'success');
    markAsSent();
}

function shareWhatsApp() {
    if (!currentIntervention) { showToast('Aucune intervention sélectionnée', 'error'); return; }
    const client = getClientById(currentIntervention.clientId);
    const msg = encodeURIComponent(`Bonjour, voici la fiche d'intervention n° ${currentIntervention.numero || ''} du ${currentIntervention.date || ''} pour ${client.nom || ''}. Technicien : ${currentIntervention.technicien || '-'}. Résultat : ${currentIntervention.resultat || '-'}.`);
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
    showToast('WhatsApp ouvert', 'success');
    markAsSent();
}

function markAsSent() {
    if (currentIntervention) {
        interventions = interventions.map(i => i.id === currentIntervention.id ? { ...i, status: 'sent' } : i);
        saveData();
        renderDashboard();
        renderInterventionsList();
    }
}

// Empêcher fermeture modale en cliquant l'overlay (optionnel)
document.getElementById('modal-client').addEventListener('click', function(e) {
    if (e.target === this) closeClientModal();
});
document.getElementById('modal-confirm').addEventListener('click', function(e) {
    if (e.target === this) closeConfirm();
});
document.getElementById('modal-camera').addEventListener('click', function(e) {
    if (e.target === this) closeCamera();
});
