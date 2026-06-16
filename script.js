// --- Configuração do Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyC0aR0ch9fIW5NN3BG6uf9pP-6Vi2L-3F8",
    authDomain: "cardapiodigital-ae432.firebaseapp.com",
    projectId: "cardapiodigital-ae432",
    storageBucket: "cardapiodigital-ae432.firebasestorage.app",
    messagingSenderId: "937349570098",
    appId: "1:937349570098:web:61038eab858707c388e62b",
    measurementId: "G-PMPLZCH4P9"
};

// Inicializa o Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
    window.auth = firebase.auth();
    window.storage = firebase.storage();
}

let editId = null; // Agora usamos ID em vez de Index para evitar erros em listas filtradas
let currentProductStep = 1;
let currentRegisterStep = 1;
window.isProcessingRegistration = false; // Flag para evitar conflitos no observer durante cadastro
window.dbStatus = 'loading'; // Status da conexão com o banco (loading, online, offline)

let sessaoAtiva = null;
try {
    const savedSession = localStorage.getItem('usuario_logado');
    if (savedSession) sessaoAtiva = JSON.parse(savedSession);
} catch (e) {
    console.error("Erro ao carregar sessão local:", e);
    localStorage.removeItem('usuario_logado');
}

// Função auxiliar para upload no Firebase Storage
async function uploadParaStorage(file, folder) {
    if (!file) return null;
    // Usamos o UID do Firebase Auth para organizar as pastas de forma segura
    const user = firebase.auth().currentUser;
    // Prioriza specificUid se fornecido, senão usa o UID do usuário logado, senão o UID da sessão, senão 'anonimo'
    const pathIdentifier = specificUid || (user ? user.uid : (sessaoAtiva ? sessaoAtiva.uid : 'anonimo'));
    
    if (!pathIdentifier || pathIdentifier === 'anonimo') {
        console.error("Não foi possível determinar o identificador para o upload. Upload cancelado.");
        return null;
    }

    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = storage.ref(`${folder}/${pathIdentifier}/${fileName}`);
    
    const snapshot = await storageRef.put(file);
    const url = await snapshot.ref.getDownloadURL();
    return url;
}

// Função auxiliar para criar slug amigável (ex: "Minha Loja" -> "minha-loja")
const gerarSlug = (texto) => {
    return texto.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z0-9]/g, "-")     // Substitui caracteres especiais por hifen
        .replace(/-+/g, "-")             // Remove hifens duplos
        .replace(/^-|-$/g, "");          // Remove hifens no início ou fim
};

let pedidosUnsubscribe = null; // Armazena a função para parar de ouvir pedidos
let cachePedidosAdmin = []; // Cache para evitar requisições repetidas ao filtrar
let filtroStatusAdmin = 'Todos'; // Estado global do filtro no Admin
let filtroDataAdmin = new Date().toLocaleDateString('en-CA'); // Inicializa com a data local (YYYY-MM-DD)

// Função auxiliar para carregar configurações da loja do Firestore
async function getStoreConfig(ownerEmail) {
    if (!window.db || !ownerEmail) return {};
    try {
        const doc = await db.collection('configuracoes').doc(ownerEmail).get();
        return doc.exists ? doc.data() : {};
    } catch (error) {
        console.error("Erro ao carregar configurações da loja do Firestore:", error);
        return {};
    }
}

function verificarProtecaoAdmin() {
    const isAdminPage = window.location.pathname.includes('admin-produtos');
    // Proteção removida a pedido do usuário
    document.body.classList.remove('is-locked');
}

async function logout() {
    // Para de ouvir pedidos ao sair
    if (pedidosUnsubscribe) pedidosUnsubscribe();
    await auth.signOut();
    localStorage.removeItem('usuario_logado'); // Limpeza extra
    window.location.href = 'index.html'; 
}

// --- Lógica Top Nav e Auth ---
let currentAuthMode = 'login';
// Ticker removido para dar lugar ao botão Meus Pedidos
window.iniciarTicker = function() {};

window.atualizarTopoNav = function() {
    const leftSide = document.getElementById('auth-status-left');
    const pedidosBtn = document.getElementById('meus-pedidos-btn');
    
    const userLogado = sessaoAtiva;

    // Status de Conexão (Indicador visual discreto)
    const color = window.dbStatus === 'online' ? 'var(--success)' : (window.dbStatus === 'offline' ? 'var(--danger)' : '#cbd5e1');
    const dot = `<span style="width: 8px; height: 8px; background: ${color}; border-radius: 50%; display: inline-block; margin-left: 8px; vertical-align: middle;" title="Banco de Dados: ${window.dbStatus}"></span>`;

    if (userLogado && leftSide) {
        const displayName = userLogado.name || (userLogado.user ? userLogado.user.split('@')[0] : 'Usuário');
        leftSide.innerHTML = `<i data-lucide="user-check" style="color:var(--success)"></i> <span>${displayName}</span>${dot}`;

        // Exibe "Meus Pedidos" se estiver logado e NÃO estiver no painel admin
        const isAdminPage = window.location.href.includes('admin-produtos.html');
        if (pedidosBtn && !isAdminPage) {
            pedidosBtn.style.display = 'flex';
        } else if (pedidosBtn) {
            pedidosBtn.style.display = 'none';
        }
    } else if (leftSide) {
        leftSide.innerHTML = `<i data-lucide="user-circle"></i> <span>Entrar / Cadastrar</span>${dot}`;
        if (pedidosBtn) pedidosBtn.style.display = 'none';
    }
    if (window.lucide) lucide.createIcons();
};

window.abrirMeusPedidos = async function() {
    const userLogado = JSON.parse(localStorage.getItem('usuario_logado'));
    if (!userLogado) return;

    const lista = document.getElementById('lista-meus-pedidos');
    if (!lista) return;

    lista.innerHTML = '<p class="loading">Carregando seus pedidos...</p>';

    const querySnapshot = await db.collection('pedidos')
                                  .where('usuario', '==', userLogado.user)
                                  .orderBy('data', 'desc')
                                  .get();
    
    const meusPedidos = [];
    querySnapshot.forEach(doc => meusPedidos.push(doc.data()));

    if (meusPedidos.length === 0) {
        lista.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding: 20px;">Você ainda não realizou pedidos.</p>';
    } else {
        lista.innerHTML = meusPedidos.map(p => `
            <li style="flex-direction: column; align-items: flex-start; gap: 5px;">
                <div style="display:flex; justify-content: space-between; width: 100%;">
                    <small style="color: var(--text-muted)">${p.data.toDate().toLocaleString()}</small>
                    <b style="color:var(--success)">R$ ${parseFloat(p.total).toFixed(2)}</b>
                </div>
                <div style="font-size: 0.85rem; font-weight: 500;">${p.itens.join(', ')}</div>
                <div style="font-size: 0.75rem; color: var(--primary-color); font-weight: 700;">Loja: ${p.restauranteOwner.toUpperCase()}</div>
            </li>
        `).join('');
    }
    openModal('modal-meus-pedidos');
};

window.abrirModalAuth = function() {
    const modal = document.getElementById('modal-auth');
    const authForm = document.getElementById('form-auth-dynamic');
    const switchMode = modal ? modal.querySelector('.auth-mode-switch') : null;
    const logoutArea = document.getElementById('btn-logout-area');
    const submitBtn = document.getElementById('btn-auth-submit');
    const authModeSwitch = modal ? modal.querySelector('.auth-mode-switch') : null;
    const title = document.getElementById('auth-modal-title');

    if (sessaoAtiva) {
        const displayName = sessaoAtiva.name || (sessaoAtiva.user ? sessaoAtiva.user.split('@')[0] : 'Usuário');
        title.innerHTML = `
            <div style="text-align:center; padding: 10px 0;">
                <div style="font-size: 0.9rem; color: var(--text-muted); font-weight: 500;">Logado como</div>
                <div style="font-size: 1.2rem; margin-top: 5px; color: var(--text-main); font-weight: 800;">${displayName}</div>
                <div class="badge ${sessaoAtiva.role === 'restaurante' ? 'available' : 'featured'}" style="margin-top: 10px; display: inline-block;">
                    ${sessaoAtiva.role === 'restaurante' ? '👨‍🍳 Proprietário' : '🛍️ Cliente'}
                </div>
            </div>`;
        
        if (authModeSwitch) authModeSwitch.style.display = 'none';
        if (document.getElementById('auth-login-fields')) document.getElementById('auth-login-fields').style.display = 'none';
        if (document.getElementById('auth-register-steps')) document.getElementById('auth-register-steps').style.display = 'none';
        if (logoutArea) logoutArea.style.display = 'block';
        if (submitBtn) submitBtn.style.display = 'none';
        if (modal) modal.classList.add('is-logged-in');
    } else {
        title.innerText = "Acesse sua conta";
        if (switchMode) switchMode.style.display = 'flex';
        if (logoutArea) logoutArea.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'block';
        if (modal) modal.classList.remove('is-logged-in');
        setAuthMode('login');
    }
    window.limparRegisterPreview(); // Garante que a prévia esteja limpa ao abrir o modal
    
    openModal('modal-auth');
};

// Validação em Tempo Real (Movida para escopo global do arquivo para ser acessível)
window.setupRealTimeValidation = function() {
    const inputs = document.querySelectorAll('#auth-register-steps input, #auth-register-steps select');
    inputs.forEach(input => {
        const group = input.closest('.form-group');
        if (group && !group.querySelector('.valid-icon')) {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'valid-icon';
            iconSpan.innerHTML = '<i data-lucide="check-circle-2" style="width:18px; height:18px;"></i>';
            group.appendChild(iconSpan);
            if (window.lucide) lucide.createIcons();
        }

        input.addEventListener('input', () => {
            let isValid = false;
            const val = input.value.trim();
            if (input.id === 'auth-name') isValid = val.length >= 3;
            else if (input.id === 'auth-user-reg') isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
            else if (input.id === 'auth-pass-reg') {
                isValid = val.length >= 6;
                window.atualizarForcaSenha(val);
            }
            else if (input.id === 'auth-phone') isValid = val.length >= 14;
            else if (input.tagName === 'SELECT') isValid = val !== "";
            else isValid = val.length > 0;
            group.classList.toggle('is-valid', isValid);
        });
    });
};

window.togglePasswordVisibility = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const btn = input.parentElement.querySelector('.toggle-password');
    const icon = btn ? btn.querySelector('i') : null;
    
    input.type = input.type === 'password' ? 'text' : 'password';
    if (icon) {
        icon.setAttribute('data-lucide', input.type === 'password' ? 'eye' : 'eye-off');
        if (window.lucide) lucide.createIcons();
    }
};

window.setAuthMode = function(mode) {
    currentAuthMode = mode;
    const btnLogin = document.getElementById('btn-mode-login');
    const btnRegister = document.getElementById('btn-mode-register');
    const loginFields = document.getElementById('auth-login-fields');
    const registerSteps = document.getElementById('auth-register-steps');

    if (!btnLogin || !btnRegister) return;
    
    btnLogin.classList.toggle('active', mode === 'login');
    btnRegister.classList.toggle('active', mode === 'register');

    if (mode === 'login') {
        if (loginFields) loginFields.style.display = 'block';
        if (registerSteps) registerSteps.style.display = 'none';
    } else {
        if (loginFields) loginFields.style.display = 'none';
        if (registerSteps) registerSteps.style.display = 'block';
        window.changeRegisterStep(1);
        window.limparRegisterPreview(); // Limpa a prévia ao mudar para o modo de registro
    }
};

window.updateRoleSelection = function(role) {
    const input = document.getElementById('auth-role');
    if (!input) return;
    input.value = role;
    
    document.querySelectorAll('.role-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.role === role);
    });
    window.changeRegisterStep(1); // Atualiza visibilidade dos passos seguintes
};

window.updateOrderTypeSelection = function(type) {
    const input = document.getElementById('tipo-pedido-toggle-hidden');
    if (!input) return;
    input.value = type;
    
    document.querySelectorAll('.order-type-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.type === type);
    });
    
    if (typeof window.toggleEnderecoField === 'function') window.toggleEnderecoField();
};

window.changeRegisterStep = function(step) {
    // Validação para impedir o avanço sem preencher os campos obrigatórios
    if (step > currentRegisterStep) {
        if (currentRegisterStep === 2) {
            const name = document.getElementById('auth-name').value.trim();
            const email = document.getElementById('auth-user-reg').value.trim();
            const pass = document.getElementById('auth-pass-reg').value.trim();

            if (!name || !email || !pass) return showToast("Preencha Nome, E-mail e Senha!", "error");
            if (!email.includes('@')) return showToast("Insira um e-mail válido!", "error");
            if (pass.length < 6) return showToast("A senha deve ter no mínimo 6 caracteres!", "error");
        }
        
        if (currentRegisterStep === 3) {
            const phone = document.getElementById('auth-phone').value.trim();
            if (!phone || phone.length < 14) return showToast("Informe um WhatsApp válido!", "error");
        }
    }

    const role = document.getElementById('auth-role').value;
    
    // Configura botões do passo 3
    const btnNextTo4 = document.getElementById('btn-next-to-4');
    const btnFinish3 = document.getElementById('btn-finish-3');
    const dot4 = document.querySelector('.restaurante-only-dot');

    if (btnNextTo4 && btnFinish3) {
        if (role === 'restaurante') {
            btnNextTo4.style.display = 'block';
            btnFinish3.style.display = 'none';
            if (dot4) dot4.style.display = 'flex';
        } else {
            btnNextTo4.style.display = 'none';
            btnFinish3.style.display = 'block';
            if (dot4) dot4.style.display = 'none';
        }
    }

    currentRegisterStep = step;
    document.querySelectorAll('.auth-step').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`auth-step-${step}`);
    if (target) target.classList.add('active');
    
    document.querySelectorAll('.auth-step-dot').forEach(dot => {
        const s = parseInt(dot.dataset.authStep);
        dot.classList.toggle('active', s === step);
        dot.classList.toggle('completed', s < step);
    });
    if (window.lucide) lucide.createIcons();
};

window.processarAuth = async function(e) {
    e.preventDefault();

    if (currentAuthMode === 'login') {
        console.log("Attempting login...");
        const email = document.getElementById('auth-user').value;
        const pass = document.getElementById('auth-pass').value;
        if (!email || !pass) return showToast('Preencha email e senha', 'error');
        
        try {
            await auth.signInWithEmailAndPassword(email, pass);
            showToast('Bem-vindo de volta!');
        } catch (error) {
            console.error("Error during login:", error);
            let msg = error.message;
            if (error.code === 'auth/invalid-credential') msg = "E-mail ou senha incorretos.";
            else if (error.code === 'auth/network-request-failed') msg = "Erro de conexão. Verifique sua internet.";
            return showToast(msg, 'error');
        }
    } else {
        // Modo de Cadastro (Register)
        window.isProcessingRegistration = true;
        console.log("Attempting registration...");
        const role = document.getElementById('auth-role').value;
        const email = document.getElementById('auth-user-reg').value;
        const pass = document.getElementById('auth-pass-reg').value;
        const name = document.getElementById('auth-name').value;
        const phone = document.getElementById('auth-phone').value;

        if (!name || name.trim().length < 3) { window.isProcessingRegistration = false; return showToast('Preencha um nome válido (mín. 3 caracteres)!', 'error'); }
        if (!email || !email.includes('@')) { window.isProcessingRegistration = false; return showToast('Use um e-mail válido!', 'error'); }
        if (!pass || pass.length < 6) { window.isProcessingRegistration = false; return showToast('A senha deve ter no mínimo 6 caracteres!', 'error'); }
        if (!phone || phone.replace(/\D/g, "").length < 10) { window.isProcessingRegistration = false; return showToast('Informe um WhatsApp válido (com DDD)!', 'error'); }

        try {
            showToast('Criando conta no sistema...', 'info');
            const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
            const user = userCredential.user;
            console.log("Firebase user created:", user.uid);
            
            // 1. Salva Perfil de Usuário
            await db.collection('usuarios').doc(user.uid).set({
                user: email,
                role: role,
                name: name,
                phone: phone,
                createdAt: new Date()
            });

            if (role === 'restaurante') {
                showToast('Configurando seu restaurante...', 'info');
                const open = document.getElementById('auth-open').value || "18";
                const close = document.getElementById('auth-close').value || "23";
                const logoFile = document.getElementById('auth-logo').files[0];
                // Passa o UID do usuário recém-criado para o upload
                let logoUrl = logoFile ? await uploadParaStorage(logoFile, 'loja', user.uid) : "";
                
                const slug = gerarSlug(name);

                // 2. Salva Configurações da Loja
                await db.collection('configuracoes').doc(email).set({
                    nome_exibicao: name,
                    whatsapp: phone.replace(/\D/g, ""),
                    abertura: open,
                    fechamento: close,
                    logo: logoUrl,
                    slug: slug,
                    owner: email
                }, { merge: true });
            }

            // 3. Define Sessão e Finaliza
            sessaoAtiva = { user: email, role: role, uid: user.uid, name: name };
            localStorage.setItem('usuario_logado', JSON.stringify(sessaoAtiva));
            window.limparRegisterPreview();
            
            if (role === 'restaurante') {
                showToast('Tudo pronto! Entrando no painel...');
                window.isProcessingRegistration = false; // Reset on success
                window.location.href = 'admin-produtos.html';
            } else {
                showToast('Conta criada com sucesso!');
                window.isProcessingRegistration = false; // Reset on success
                // Para o cliente, apenas fechamos o modal; o observer atualizará o topo
                if (typeof window.closeModal === 'function') window.closeModal('modal-auth');
                window.atualizarTopoNav();
            }
        } catch (error) {
            console.error("Error during registration:", error);
            window.isProcessingRegistration = false; // Reset on error
            let msg = error.message;
            if (error.code === 'auth/email-already-in-use') msg = "Este e-mail já está em uso.";
            else if (error.code === 'auth/invalid-email') msg = "O formato do e-mail é inválido.";
            else if (error.code === 'auth/weak-password') msg = "A senha é muito fraca.";
            else if (error.code === 'auth/network-request-failed') msg = "Erro de conexão. Verifique sua internet.";
                return showToast(msg, 'error');
            }
        }
    };

/**
 * Inicialização Robusta
 */
function inicializarSistema() {
    if (!window.auth || !window.db) {
        console.error("Firebase não carregado corretamente.");
        return;
    }

    // Garante que o login persiste ao fechar o navegador
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    
    // Health Check da Conexão
    verificarConexaoBanco();

    // Máscara de Telefone Centralizada (Cadastro e Checkout)
    const aplicarMascaraTelefone = (elId) => {
        const el = document.getElementById(elId);
        if (!el) return;
        el.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, ""); // Remove não dígitos
            if (v.length > 11) v = v.substring(0, 11); // Limita a 11 dígitos
            v = v.replace(/^(\d{2})(\d)/g, "($1) $2"); // (00) 
            v = v.replace(/(\d)(\d{4})$/, "$1-$2");    // 00000-0000
            e.target.value = v;
        });
    };

    aplicarMascaraTelefone('auth-phone');        // Telefone no Cadastro
    aplicarMascaraTelefone('telefone-cliente'); // Telefone no Checkout

    // Se estiver na página principal (index.html), carrega os dados da loja
    // Isso garante que Firebase esteja inicializado antes de tentar carregar dados da loja
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        if (typeof window.loadStoreSpecificData === 'function') {
            window.loadStoreSpecificData();
        }
    }
    window.atualizarForcaSenha = function(val) {
        const meter = document.getElementById('strength-meter');
        const bar = document.getElementById('strength-bar');
        const text = document.getElementById('strength-text');
        if (!meter || !bar || !text) return;
        
        if (val.length > 0) {
            meter.style.display = 'block';
            let score = 0;
            if (val.length >= 8) score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            let width = "33%", color = "var(--danger)", label = "Fraca";
            if (score >= 3) { width = "100%"; color = "var(--success)"; label = "Forte"; }
            else if (score >= 1) { width = "66%"; color = "#fbbf24"; label = "Média"; }

            bar.style.width = width;
            bar.style.backgroundColor = color;
            text.innerText = label;
            text.style.color = color;
        } else {
            meter.style.display = 'none';
        }
    };
    
    // Reinicia a validação visual quando o modal abre ou muda de modo
    const originalAbrirModal = window.abrirModalAuth;
    window.abrirModalAuth = function() {
        originalAbrirModal();
        document.querySelectorAll('.form-group').forEach(g => g.classList.remove('is-valid'));
        if (window.setupRealTimeValidation) window.setupRealTimeValidation();
    };

    // Prévia de Imagem para o Cadastro de Restaurante
    window.handleRegisterImagePreview = function(input) {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewImg = document.getElementById('auth-logo-preview-img');
                const previewCont = document.getElementById('auth-logo-preview-container');
                previewImg.src = e.target.result;
                previewCont.style.display = 'block';
                if (window.lucide) lucide.createIcons();
            }
            reader.readAsDataURL(file);
        }
    };

    window.limparRegisterPreview = function() {
        const fileInput = document.getElementById('auth-logo');
        if (fileInput) fileInput.value = ''; // Limpa o input de arquivo
        const previewImg = document.getElementById('auth-logo-preview-img');
        if (previewImg) previewImg.src = '';
        const previewCont = document.getElementById('auth-logo-preview-container');
        if (previewCont) previewCont.style.display = 'none';
    }

        // Observador de Autenticação Centralizado
        auth.onAuthStateChanged(async (user) => {
            const isAdminPage = window.location.pathname.includes('admin-produtos');
            if (window.isProcessingRegistration) return; // Não interfere no cadastro

            if (user) {
                try {
                    let perfil = null;
                    // Tenta buscar o perfil por até 5 segundos (útil para novas contas)
                    for (let i = 0; i < 10; i++) {
                        const doc = await db.collection('usuarios').doc(user.uid).get();
                        if (doc.exists) {
                            perfil = doc.data();
                            break;
                        }
                        await new Promise(res => setTimeout(res, 500));
                    }

                    if (perfil) {
                        sessaoAtiva = { user: user.email, role: perfil.role, uid: user.uid, name: perfil.name };
                    } else {
                        sessaoAtiva = { user: user.email, role: 'comprador', uid: user.uid };
                    }
                    localStorage.setItem('usuario_logado', JSON.stringify(sessaoAtiva));
                } catch (error) {
                    sessaoAtiva = { user: user.email, role: 'comprador', uid: user.uid };
                    localStorage.setItem('usuario_logado', JSON.stringify(sessaoAtiva));
                }

                if (typeof window.closeModal === 'function') window.closeModal('modal-auth');
                atualizarTopoNav();

                if (isAdminPage) {
                    // Se caiu na página admin mas não é restaurante, volta pro início
                    if (sessaoAtiva.role !== 'restaurante') {
                        window.location.href = 'index.html';
                        return;
                    }
                    document.body.classList.remove('is-locked');
                    showSection('dashboard');
                    renderizarHeaderAdmin();
                    atualizarListaAdmin();
                    atualizarRelatorio();
                    atualizarSelectCategorias();
                } else if (sessaoAtiva.role === 'restaurante' && !isAdminPage) {
                    if (confirm('Você está logado como restaurante. Deseja ir para o Painel Administrativo?')) {
                        window.location.href = 'admin-produtos.html';
                    }
                }
            } else {
                sessaoAtiva = null;
                localStorage.removeItem('usuario_logado');
                atualizarTopoNav();
                // Bloqueio removido
            }
        });
}

/**
 * Verifica a saúde da conexão com o Firestore
 */
function verificarConexaoBanco() {
    db.collection('configuracoes').limit(1).get()
        .then(() => {
            window.dbStatus = 'online';
            window.atualizarTopoNav();
        })
        .catch((err) => {
            window.dbStatus = 'offline';
            window.atualizarTopoNav();
            console.error("Falha na conexão Firestore:", err);
        });
}

// Centraliza a inicialização apenas no carregamento do DOM para evitar erros de referência nula
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarSistema);
} else {
    inicializarSistema();
}

window.iconMap = {
    'Lanches': 'sandwich',
    'Pizzas': 'pizza',
    'Acompanhamentos': 'utensils',
    'Bebidas': 'cup-soda',
    'Sobremesas': 'ice-cream',
    'Combos': 'package',
    'Destaques': 'star',
    'Outros': 'package'
};

window.openModal = function(id) {
    document.getElementById(id).style.display = 'flex';
    document.body.classList.add('no-scroll');
}

window.closeModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('no-scroll');
        if (id === 'modal-produto') {
            editId = null;
            const form = document.getElementById('cadastroProdutoForm');
            if (form) form.reset();
            changeProductStep(1); // Volta para o primeiro passo
            limparPreview();
            document.getElementById('modal-titulo').innerText = 'Novo Produto';
            document.getElementById('btnSalvar').innerText = 'Cadastrar Produto';
        }
    }
};

window.changeProductStep = function(step) {
    currentProductStep = step;
    document.querySelectorAll('.product-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`prod-step-${step}`).classList.add('active');
    
    document.querySelectorAll('[data-prod-step]').forEach(dot => {
        const s = parseInt(dot.dataset.prodStep);
        dot.classList.toggle('active', s === step);
        dot.classList.toggle('completed', s < step);
    });
    lucide.createIcons();
};

// Fechar modal ao clicar fora (no fundo) - Admin
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        window.closeModal(event.target.id);
    }
});

window.showSection = function(sectionId) {
    // Lista de todas as seções para garantir que apenas uma fique visível
    const secoes = ['dashboard', 'cardapio', 'config'];
    
    secoes.forEach(id => {
        const el = document.getElementById('section-' + id);
        if (el) el.style.display = (id === sectionId) ? 'block' : 'none';
    });

    // Atualiza o estado visual do menu lateral/superior
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const activeNav = document.getElementById('nav-' + sectionId);
    if (activeNav) activeNav.classList.add('active');
    
    lucide.createIcons();
}

// Migrando carregarLeads para Firestore
async function carregarLeads() {
    if (!sessaoAtiva || !sessaoAtiva.user || !window.db) return [];
    try {
        const querySnapshot = await db.collection('leads')
                                      .where('restauranteOwner', '==', sessaoAtiva.user)
                                      .get();
        const leads = [];
        querySnapshot.forEach(doc => leads.push(doc.data()));
        return leads;
    } catch (error) {
        console.error("Erro ao carregar leads do Firestore:", error);
        return [];
    }
}

// Atualizando carregarConfiguracoesRestaurante para usar a nova função getStoreConfig
async function carregarConfiguracoesRestaurante() {
    return await getStoreConfig(sessaoAtiva.user);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);
}

// Função auxiliar para converter arquivo em Base64
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// Carregar e mostrar produtos para o admin
async function atualizarListaAdmin() {
    if (!sessaoAtiva || sessaoAtiva.role !== 'restaurante' || !window.db) return;
    
    const listaAdmin = document.getElementById('lista-admin');
    if (!listaAdmin) return;

    try {
        // Busca apenas os produtos onde o campo 'owner' é igual ao usuário logado
        const querySnapshot = await db.collection('produtos')
                                      .where('owner', '==', sessaoAtiva.user)
                                      .get();
        
        const meusProdutos = [];
        querySnapshot.forEach(doc => {
            meusProdutos.push({ ...doc.data(), id: doc.id });
        });

        listaAdmin.innerHTML = '';

        meusProdutos.forEach((prod) => {
        const iconName = window.iconMap[prod.categoria] || 'package';
        const imageContent = prod.imagem 
            ? `<img src="${prod.imagem}" style="width:100%; height:180px; object-fit:cover; border-radius:8px;">`
            : `<div class="card-image-placeholder" style="height:180px; border-radius:8px;">
                <i data-lucide="${iconName}"></i>
               </div>`;

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            ${imageContent}
            <div style="display: flex; flex-direction: column; flex-grow: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="badge">${prod.categoria}</span>
                    <span class="badge ${prod.disponivel !== false ? 'available' : 'unavailable'}">
                        ${prod.disponivel !== false ? '● Ativo' : '● Pausado'}
                    </span>
                </div>
                <div style="margin-top: 5px; display: flex; gap: 5px;">
                    ${prod.tagVeggie ? '<span class="badge veggie">VEG</span>' : ''}
                    ${prod.tagSpicy ? '<span class="badge spicy">PIMENTA</span>' : ''}
                    ${prod.tagFeatured ? '<span class="badge featured">★</span>' : ''}
                </div>
                <h3 style="text-align: left; margin: 10px 0;">${prod.nome}</h3>
                <p style="font-size: 0.8rem; color: var(--text-muted);">Estoque: ${prod.estoque !== undefined && prod.estoque !== "" ? prod.estoque : '∞'}</p>
                ${prod.ofertaExpira ? `<p style="font-size: 0.7rem; color: var(--danger);">Expira: ${new Date(prod.ofertaExpira).toLocaleString()}</p>` : ''}
                <p class="preco">R$ ${parseFloat(prod.preco).toFixed(2)}</p>
                <button onclick="editarProduto('${prod.id}')" class="btn-edit">
                    Editar Produto
                </button>
                <button onclick="excluirProduto('${prod.id}')" class="btn-danger">
                    Remover Produto
                </button>
            </div>
        `;
        listaAdmin.appendChild(card);
    });
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        showToast('Erro ao carregar lista do banco', 'error');
    }
    lucide.createIcons();
}

// Gerenciamento de Prévia de Imagem
window.handleImagePreview = function(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewImg = document.getElementById('image-preview-img');
            const previewCont = document.getElementById('preview-container');
            previewImg.src = e.target.result;
            previewCont.style.display = 'block';
            lucide.createIcons();
        }
        reader.readAsDataURL(file);
    }
};

window.limparPreview = function() {
    document.getElementById('imagem').value = '';
    document.getElementById('imagemBase64').value = '';
    document.getElementById('image-preview-img').src = '';
    document.getElementById('preview-container').style.display = 'none';
};

// Salvar novo produto
document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'cadastroProdutoForm') return;
    e.preventDefault();
    
    showToast('Salvando produto...', 'info');
    
    const fileInput = document.getElementById('imagem');
    const arquivoImagem = fileInput.files[0];
    let imagemData = document.getElementById('imagemBase64').value;

    try {
        // Se um novo arquivo foi selecionado, faz upload para o Storage
        if (arquivoImagem) {
            imagemData = await uploadParaStorage(arquivoImagem, 'produtos');
        }
    } catch (err) {
        console.error("Erro no upload da imagem:", err);
        return showToast('Erro ao subir imagem', 'error');
    }

    const novoProduto = {
        owner: sessaoAtiva.user, // Atrela o produto ao restaurante logado
        nome: document.getElementById('nome').value,
        preco: document.getElementById('preco').value,
        ofertaExpira: document.getElementById('ofertaExpira').value,
        estoque: document.getElementById('estoque').value,
        descricao: document.getElementById('descricao').value,
        categoria: document.getElementById('categoria').value,
        imagem: imagemData,
        disponivel: document.getElementById('disponivel').checked,
        adicionais: document.getElementById('adicionais').value,
        tagVeggie: document.getElementById('tagVeggie').checked,
        tagSpicy: document.getElementById('tagSpicy').checked,
        tagFeatured: document.getElementById('tagFeatured').checked
    };

    try {
        if (!editId) {
            // Firestore gera o ID automaticamente
            const docRef = await db.collection('produtos').add(novoProduto);
            // Opcional: Salva o ID gerado dentro do próprio objeto para facilitar filtros
            await docRef.update({ id: docRef.id });
            showToast('Produto salvo no Firestore!');
        } else {
            // Modo de Edição: Atualiza documento específico
            await db.collection('produtos').doc(editId).set(novoProduto, { merge: true });
            editId = null; 
            document.getElementById('btnSalvar').innerText = 'Cadastrar Produto';
            showToast('Produto atualizado!');
        }

        e.target.reset();
        document.getElementById('imagemBase64').value = '';
        await atualizarListaAdmin(); // Agora é uma chamada assíncrona
        closeModal('modal-produto');
    } catch (error) {
        console.error("Erro ao salvar:", error);
        showToast('Erro ao conectar com o banco de dados', 'error');
    }
});

// Função para carregar dados no formulário para edição
window.editarProduto = async function(id) {
    // Busca o produto específico no Firestore para garantir dados atualizados
    const doc = await db.collection('produtos').doc(id).get();
    if (!doc.exists) return;
    const prod = doc.data();
    
    if (!prod) return;

    document.getElementById('nome').value = prod.nome;
    document.getElementById('preco').value = prod.preco;
    document.getElementById('ofertaExpira').value = prod.ofertaExpira || '';
    document.getElementById('estoque').value = prod.estoque || '';
    document.getElementById('descricao').value = prod.descricao;
    document.getElementById('categoria').value = prod.categoria;
    document.getElementById('imagemBase64').value = prod.imagem || '';
    document.getElementById('imagem').value = ''; // Limpa o seletor de arquivo
    document.getElementById('disponivel').checked = prod.disponivel !== false;
    document.getElementById('adicionais').value = prod.adicionais || '';
    document.getElementById('tagVeggie').checked = !!prod.tagVeggie;
    document.getElementById('tagSpicy').checked = !!prod.tagSpicy;
    document.getElementById('tagFeatured').checked = !!prod.tagFeatured;

    atualizarSelectCategorias(); // Garante que as categorias customizadas apareçam
    changeProductStep(1); // Sempre inicia no passo 1 ao abrir para editar

    // Carrega a prévia se houver imagem
    if (prod.imagem) {
        const previewImg = document.getElementById('image-preview-img');
        const previewCont = document.getElementById('preview-container');
        previewImg.src = prod.imagem;
        previewCont.style.display = 'block';
    }

    editId = id;
    document.getElementById('modal-titulo').innerText = 'Editar Produto';
    document.getElementById('btnSalvar').innerText = 'Salvar Alterações';
    openModal('modal-produto');
};

window.promptNovaCategoria = async function() {
    const nova = prompt("Digite o nome da nova categoria:");
    if (nova && nova.trim() !== "") {
        try {
            const config = await carregarConfiguracoesRestaurante(); // Carrega do Firestore
            let existentes = config.categorias_custom ? config.categorias_custom.split(',').map(c => c.trim()) : [];
            if (existentes.includes(nova)) return showToast("Esta categoria já existe!", "error");
            existentes.push(nova);
            
            await db.collection('configuracoes').doc(sessaoAtiva.user).set({ categorias_custom: existentes.join(', ') }, { merge: true });
            await atualizarSelectCategorias();
            document.getElementById('categoria').value = nova;
            showToast(`Categoria "${nova}" adicionada!`);
        } catch (error) {
            showToast("Erro ao adicionar categoria", "error");
        }
    }
};

// Relatório de Vendas
function atualizarRelatorio() {
    if (!sessaoAtiva) return;
    if (pedidosUnsubscribe) return; // Evita criar múltiplos listeners

    // Define a data inicial no input (hoje)
    const inputData = document.getElementById('filtro-data-admin');
    if (inputData) inputData.value = filtroDataAdmin;

    let isFirstLoad = true;

    // Configura o Listener em Tempo Real
    pedidosUnsubscribe = db.collection('pedidos')
        .where('restauranteOwner', '==', sessaoAtiva.user)
        .orderBy('data', 'desc')
        .onSnapshot(snapshot => {
            cachePedidosAdmin = [];
            snapshot.forEach(doc => cachePedidosAdmin.push({ ...doc.data(), id: doc.id }));

            // Tocar som e mostrar toast se for um novo pedido (não no carregamento inicial)
            if (!isFirstLoad) {
                snapshot.docChanges().forEach(change => {
                    if (change.type === "added") {
                        // Som de notificação (opcional)
                        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
                        showToast("Novo pedido recebido! 🔔", "info");
                    }
                });
            }
            isFirstLoad = false;
            aplicarFiltroEPublicar();
        }, error => {
            console.error("Erro ao ouvir pedidos:", error); // Adicionado para depuração detalhada
            showToast("Erro ao conectar ao monitor de pedidos", "error");
        });
}

window.filtrarPedidosAdmin = function(status) {
    filtroStatusAdmin = status;
    aplicarFiltroEPublicar();
};

window.filtrarDataAdmin = function(data) {
    filtroDataAdmin = data;
    aplicarFiltroEPublicar();
};

function aplicarFiltroEPublicar() {
    let filtrados = cachePedidosAdmin;

    // Filtro de Status
    if (filtroStatusAdmin !== 'Todos') {
        filtrados = filtrados.filter(p => p.status === filtroStatusAdmin);
    }

    // Filtro de Data
    if (filtroDataAdmin) {
        filtrados = filtrados.filter(p => {
            if (!p.data || !p.data.toDate) return false;
            const dataPedido = p.data.toDate().toLocaleDateString('en-CA');
            return dataPedido === filtroDataAdmin;
        });
    }

    renderizarRelatorioUI(filtrados);
}

// Função auxiliar para renderizar a interface do relatório
function renderizarRelatorioUI(meuHistorico) {
    const totalPedidos = meuHistorico.length;
    const totalFaturamento = meuHistorico.reduce((sum, pedido) => sum + pedido.total, 0);

    document.getElementById('report-pedidos').innerText = totalPedidos;
    document.getElementById('report-faturamento').innerText = `R$ ${totalFaturamento.toFixed(2)}`;

    const listaPedidos = document.getElementById('lista-pedidos-historico');
    if (listaPedidos) {
        let html = '<div style="overflow-x: auto;"><table style="width:100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: var(--shadow-sm);">';
        html += '<tr style="background: #f8fafc; text-align: left;"><th style="padding:12px;">Data</th><th style="padding:12px;">Cliente</th><th style="padding:12px;">Itens</th><th style="padding:12px;">Total</th><th style="padding:12px;">Status</th><th style="padding:12px;">Ações</th></tr>';
        
        meuHistorico.slice(0, 15).forEach(ped => {
            const statusOptions = ['Pendente', 'Em Preparo', 'Saiu para Entrega', 'Entregue', 'Cancelado'];
            const selectHtml = `
                <select onchange="alterarStatusPedido('${ped.id}', this.value)" style="padding: 4px; border-radius: 6px; border: 1px solid #ddd; font-size: 0.8rem; background: ${ped.status === 'Cancelado' ? '#fee2e2' : '#f0fdf4'};">
                    ${statusOptions.map(opt => `<option value="${opt}" ${ped.status === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            `;

            html += `<tr style="border-top: 1px solid #f1f5f9;">
                <td style="padding:12px; font-size: 0.85rem;">${ped.data && ped.data.toDate ? ped.data.toDate().toLocaleString() : '---'}</td>
                <td style="padding:12px; font-weight: bold;">${ped.cliente}</td>
                <td style="padding:12px; font-size: 0.85rem; color: var(--text-muted);">${ped.itens.join(', ')}</td>
                <td style="padding:12px; font-weight: bold; color: var(--success);">R$ ${parseFloat(ped.total).toFixed(2)}</td>
                <td style="padding:12px;">${selectHtml}</td>
                <td style="padding:12px;"><button onclick="imprimirPedidoFirestore('${ped.id}')" class="btn-print">🖨️ Imprimir</button></td>
            </tr>`;
        });
        html += '</table></div>';
        listaPedidos.innerHTML = html;
    }
}

window.alterarStatusPedido = async function(docId, novoStatus) {
    try {
        // 1. Atualizar o status no Firestore
        await db.collection('pedidos').doc(docId).update({
            status: novoStatus
        });
        showToast(`Status atualizado: ${novoStatus}`);

        // 2. Buscar detalhes do pedido para enviar a mensagem
        const pedidoDoc = await db.collection('pedidos').doc(docId).get();
        if (!pedidoDoc.exists) {
            console.error("Pedido não encontrado para enviar mensagem.");
            return;
        }
        const pedido = pedidoDoc.data();

        // 3. Buscar configurações do restaurante para o nome de exibição
        const configRestaurante = await getStoreConfig(pedido.restauranteOwner);
        const nomeRestaurante = configRestaurante.nome_exibicao || pedido.restauranteOwner.split('@')[0].toUpperCase();

        // 4. Construir a mensagem
        const clienteNome = pedido.cliente || "Cliente";
        const clienteTelefone = pedido.telefone; // O telefone do cliente já está salvo no pedido

        if (!clienteTelefone) {
            showToast("Telefone do cliente não disponível para enviar mensagem.", "error");
            return;
        }

        const mensagem = `Olá ${clienteNome}! 👋%0ASeu pedido *#${docId.slice(-6)}* no *${nomeRestaurante}* agora está com o status: *${novoStatus}*.%0A%0AQualquer dúvida, entre em contato!`;

        // 5. Abrir o WhatsApp (com confirmação)
        if (confirm(`Deseja enviar uma mensagem automática para ${clienteNome} (${clienteTelefone}) sobre a mudança de status para "${novoStatus}"?`)) {
            const linkWhatsapp = `https://wa.me/${clienteTelefone}?text=${mensagem}`;
            window.open(linkWhatsapp, '_blank');
        }
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
        showToast("Erro ao atualizar status", "error");
    }
};

window.imprimirPedidoFirestore = async function(docId) {
    const doc = await db.collection('pedidos').doc(docId).get();
    if (!doc.exists) return;
    const ped = doc.data();

    const janelaImpressao = window.open('', '', 'width=350,height=600');
    janelaImpressao.document.write(`
        <html>
            <head><title>Ticket de Cozinha</title></head>
            <body style="font-family: 'Courier New', monospace; padding: 5mm; width: 80mm; font-size: 13px; line-height: 1.2;">
                <div style="text-align:center; font-weight:bold; font-size: 16px;">*** MEU RESTAURANTE ***</div>
                <div style="text-align:center; margin-bottom: 5px;">-------------------------------</div>
                <div><b>ID:</b> #${docId.slice(-6)}</div>
                <div><b>DATA:</b> ${ped.data.toDate().toLocaleString()}</div>
                <div><b>CLIENTE:</b> ${ped.cliente}</div>
                <div style="margin: 5px 0;">-------------------------------</div>
                <div style="font-weight:bold; text-align:center;">ITENS DO PEDIDO</div>
                <div style="margin: 5px 0;">-------------------------------</div>
                ${ped.itens.map(i => `<div style="margin-bottom: 4px;">${i}</div>`).join('')}
                <div style="margin: 5px 0;">-------------------------------</div>
                <div style="text-align:right; font-weight:bold; font-size: 15px;">TOTAL: R$ ${parseFloat(ped.total).toFixed(2)}</div>
                <div style="text-align:center; margin-top: 10px;">-------------------------------</div>
                <div style="text-align:center;">COZINHA</div>
            </body>
        </html>
    `);
    janelaImpressao.print();
    janelaImpressao.close();
};

window.limparHistoricoVendas = async function() {
    if(confirm('Deseja realmente zerar o relatório de vendas?')) {
        try {
            const batch = db.batch();
            const querySnapshot = await db.collection('pedidos').where('restauranteOwner', '==', sessaoAtiva.user).get();
            querySnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            await atualizarRelatorio();
        } catch (error) { console.error("Erro ao limpar histórico:", error); showToast('Erro ao limpar histórico', 'error'); }
        showToast('Relatório zerado.');
    }
}

// --- Lógica de Edição Inline no Header ---
window.ativarEdicaoInline = function(campo) {
    const IDs = {
        nome: 'admin-nome-loja',
        descricao: 'admin-descricao-loja',
        horario: 'admin-horario-display',
        tempo: 'admin-tempo-display'
    };

    // Define limites de caracteres para cada campo
    const limites = {
        nome: 35,
        descricao: 80, // Limite ideal para manter em duas linhas no cardápio
        horario: 20,
        tempo: 15
    };
    
    const el = document.getElementById(IDs[campo]);
    if (!el || el.tagName === 'INPUT') return;

    const parent = el.closest('.editable-container');
    const valorAtual = el.childNodes[0].textContent.trim(); // Pega apenas o texto, ignorando ícones
    const max = limites[campo] || 100;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = valorAtual;
    input.maxLength = max;
    input.className = 'input-inline-edit';
    input.style.width = (el.offsetWidth + 20) + 'px';

    // Cria o elemento do contador
    const counter = document.createElement('span');
    counter.className = 'inline-edit-counter';
    counter.innerText = `${valorAtual.length}/${max}`;
    if (parent) parent.appendChild(counter);

    // Atualiza o contador enquanto digita
    input.addEventListener('input', () => {
        counter.innerText = `${input.value.length}/${max}`;
    });

    const salvar = () => {
        const novoValor = input.value.trim() || valorAtual;
        el.innerText = novoValor;
        input.replaceWith(el);
        if (counter) counter.remove(); // Remove o contador ao salvar
        salvarConfigRapida(campo, novoValor);
    };

    input.addEventListener('blur', salvar);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') salvar(); });

    el.replaceWith(input);
    input.focus();
};

window.triggerLogoUpload = () => document.getElementById('input-edit-logo').click();
window.triggerCoverUpload = () => document.getElementById('input-edit-cover').click();

window.handleInlineImageUpload = async function(input, campo) {
    const file = input.files[0];
    if (!file) return;

    try {
        showToast('Fazendo upload da imagem...', 'info');
        const url = await uploadParaStorage(file, 'loja');
        
        // Atualiza diretamente no Firestore
        await db.collection('configuracoes').doc(sessaoAtiva.user).set({
            [campo]: url
        }, { merge: true });

        showToast('Imagem atualizada!');
        // Recarrega o header para mostrar a nova imagem
        renderizarHeaderAdmin();
    } catch (err) {
        showToast('Erro ao carregar imagem', 'error');
    }
};

window.salvarConfigRapida = async function(campo, valor) {
    try {
        const config = await carregarConfiguracoesRestaurante();
        
        if (campo === 'nome') {
            config.nome_exibicao = valor;
            config.slug = gerarSlug(valor); // GERA O SLUG AO EDITAR O NOME NO HEADER
        }
        if (campo === 'descricao') config.descricao_loja = valor;
        if (campo === 'tempo') {
            let val = valor.toLowerCase().includes('min') ? valor : valor + ' min';
            config.tempo_entrega = val;
        }
        if (campo === 'horario') {
            const partes = valor.replace(/h/g, '').split(/[-–]/);
            if (partes.length === 2) {
                config.abertura = partes[0].trim();
                config.fechamento = partes[1].trim();
            }
        }

        await db.collection('configuracoes').doc(sessaoAtiva.user).set(config, { merge: true });
        showToast('Atualizado!');
        renderizarHeaderAdmin(); // Recarrega o header
    } catch (error) {
        showToast("Erro ao atualizar configuração", "error");
    }
};

async function renderizarHeaderAdmin() {
    if (!sessaoAtiva || sessaoAtiva.role !== 'restaurante') return;

    let config = await carregarConfiguracoesRestaurante(); // Carrega do Firestore
    const nomeEl = document.getElementById('admin-nome-loja');
    if (!nomeEl) return; // Segurança para não rodar fora da página admin

    const fallbackName = sessaoAtiva.name || (sessaoAtiva.user ? sessaoAtiva.user.split('@')[0].toUpperCase() : "PAINEL GESTOR");

    // Garante que a loja tenha um slug amigável baseado no nome (e não no email)
    if (!config.slug) {
        const novoSlug = gerarSlug(config.nome_exibicao || fallbackName);
        await db.collection('configuracoes').doc(sessaoAtiva.user).set({
            slug: novoSlug,
            nome_exibicao: config.nome_exibicao || fallbackName
        }, { merge: true });
        config.slug = novoSlug;
    }

    nomeEl.innerText = config.nome_exibicao || fallbackName;
    
    // Nova: Preencher mensagem de boas-vindas
    const welcomeMessageEl = document.getElementById('admin-welcome-message');
    if (welcomeMessageEl) {
        const ownerName = sessaoAtiva.name || (sessaoAtiva.user ? sessaoAtiva.user.split('@')[0] : 'Proprietário');
        welcomeMessageEl.innerText = `Bem-vindo(a), ${ownerName}!`;
    }

    document.getElementById('admin-descricao-loja').innerText = config.descricao_loja || "Gerencie seus produtos aqui";
    document.getElementById('admin-horario-display').innerText = `${config.abertura || 18}h - ${config.fechamento || 23}h`;
    document.getElementById('admin-tempo-display').innerText = config.tempo_entrega || '30-50 min';

    if (config.logo) {
        const logo = document.getElementById('logo-admin');
        if (logo) { logo.src = config.logo; logo.style.display = 'block'; }
    }

    if (config.banner_header) {
        const cover = document.getElementById('admin-cover-bg');
        if (cover) {
            cover.style.backgroundImage = `url('${config.banner_header}')`;
            cover.style.backgroundSize = 'cover';
            cover.style.backgroundPosition = 'center';
        }
    }

    // Atualiza o link da loja exibido no dashboard
    const linkEl = document.getElementById('link-loja-exibicao');
    if (linkEl) {
        const urlBase = window.location.href.split('admin-produtos.html')[0];
        const storeSlug = config.slug || sessaoAtiva.user; // Fallback para e-mail se não houver slug
        linkEl.innerText = `${urlBase}index.html?loja=${storeSlug}`;
    }
}

window.copiarLinkLoja = function() {
    const linkEl = document.getElementById('link-loja-exibicao');
    if (linkEl) {
        const link = linkEl.innerText;
        navigator.clipboard.writeText(link);
        showToast('Link copiado para a área de transferência!');
    }
};

// Lógica para Configurações da Loja (Integrada ao Script Principal)
document.addEventListener('DOMContentLoaded', async () => {
    const configForm = document.getElementById('configLojaForm');
    if (!configForm) return;

    const lojaFechadaManualmente = document.getElementById('lojaFechadaManualmente');
    const inputFreteGratis = document.getElementById('inputFreteGratis');
    const inputPedidoMinimo = document.getElementById('inputPedidoMinimo');
    const inputWhatsapp = document.getElementById('inputWhatsapp');
    const inputPix = document.getElementById('inputPix');
    const inputTaxa = document.getElementById('inputTaxa');
    const inputCupons = document.getElementById('inputCupons');
    const inputCategoriasCustom = document.getElementById('inputCategoriasCustom');
    const inputBanners = document.getElementById('inputBanners');
    const inputLogo = document.getElementById('inputLogo'); // Input de arquivo para logo

    const configAtual = await carregarConfiguracoesRestaurante();

    // Carregar valores iniciais
    if (configAtual.logo && document.getElementById('logo-admin')) {
        const logoAdmin = document.getElementById('logo-admin');
        logoAdmin.src = configAtual.logo;
        logoAdmin.style.display = 'block'; // Garante que a logo seja exibida
    }
    
    inputFreteGratis.value = configAtual.frete_gratis_valor || "";
    lojaFechadaManualmente.checked = configAtual.fechada_manualmente === true;
    inputPedidoMinimo.value = configAtual.pedido_minimo || "";
    inputWhatsapp.value = configAtual.whatsapp || "";
    inputPix.value = configAtual.pix || "";
    inputTaxa.value = configAtual.taxa_entrega || 5.00;
    inputCategoriasCustom.value = configAtual.categorias_custom || "";

    configForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const novasConfigs = {
            ...configAtual,
            fechada_manualmente: lojaFechadaManualmente.checked,
            frete_gratis_valor: inputFreteGratis.value,
            pedido_minimo: inputPedidoMinimo.value,
            whatsapp: inputWhatsapp.value,
            pix: inputPix.value,
            taxa_entrega: inputTaxa.value,
            cupons: inputCupons.value,
            categorias_custom: inputCategoriasCustom.value
        };

        // Força a criação do slug se ele não existir ou se o nome de exibição for válido
        const nomeParaSlug = configAtual.nome_exibicao || sessaoAtiva.name;
        if (nomeParaSlug) {
            novasConfigs.slug = gerarSlug(nomeParaSlug);
        }

        const arquivoLogo = inputLogo.files[0];
        if (arquivoLogo) {
            showToast('Fazendo upload da logo...', 'info');
            novasConfigs.logo = await uploadParaStorage(arquivoLogo, 'loja');
        }
        
        const arquivosBanners = document.getElementById('inputBanners').files;
        if (arquivosBanners.length > 0) {
            showToast('Fazendo upload dos banners...', 'info');
            const promises = Array.from(arquivosBanners).map(file => uploadParaStorage(file, 'banners'));
            novasConfigs.banners = await Promise.all(promises);
        }

        // Salva as configurações no Firestore
        await db.collection('configuracoes').doc(sessaoAtiva.user).set(novasConfigs, { merge: true });

        showToast('Configurações salvas!');
        await renderizarHeaderAdmin(); // Recarrega o header com as novas configs
        await atualizarSelectCategorias(); // Atualiza as categorias no select
    });
});

async function atualizarSelectCategorias() {
    const select = document.getElementById('categoria');
    if (!select) return;
    
    const config = await carregarConfiguracoesRestaurante(); // Carrega do Firestore
    const categoriasPadrao = ['Lanches', 'Pizzas', 'Acompanhamentos', 'Bebidas', 'Sobremesas', 'Outros'];
    const customStr = config.categorias_custom || "";
    const custom = customStr.split(',').map(c => c.trim()).filter(c => c !== "");
    
    const todas = [...new Set([...categoriasPadrao, ...custom])];
    
    const valorAtual = select.value;
    select.innerHTML = todas.map(c => `<option value="${c}">${c}</option>`).join('');
    if (todas.includes(valorAtual)) select.value = valorAtual;
}

// Excluir produto
window.excluirProduto = async function(id) {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        try {
            await db.collection('produtos').doc(id).delete();
            showToast('Produto removido com sucesso!');
            await atualizarListaAdmin();
        } catch (error) {
            showToast('Erro ao excluir do banco', 'error');
        }
    }
};