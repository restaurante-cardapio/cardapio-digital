let editId = null; // Agora usamos ID em vez de Index para evitar erros em listas filtradas
let currentProductStep = 1;

let sessaoAtiva = JSON.parse(localStorage.getItem('usuario_logado'));

function verificarProtecaoAdmin() {
    const isAdminPage = window.location.href.includes('admin-produtos.html');
    if (isAdminPage) {
        sessaoAtiva = JSON.parse(localStorage.getItem('usuario_logado'));
        if (!sessaoAtiva || sessaoAtiva.role !== 'restaurante') {
            document.body.classList.add('is-locked');
            // Abre o modal de login automaticamente se não houver restaurante logado
            setTimeout(() => { if (typeof window.abrirModalAuth === 'function') window.abrirModalAuth(); }, 500);
        }
    }
}

function logout() {
    localStorage.removeItem('usuario_logado');
    window.location.reload(); 
}

// --- Lógica Top Nav e Auth ---
let currentAuthMode = 'login';
// Ticker removido para dar lugar ao botão Meus Pedidos
window.iniciarTicker = function() {};

window.atualizarTopoNav = function() {
    const leftSide = document.getElementById('auth-status-left');
    const pedidosBtn = document.getElementById('meus-pedidos-btn');
    // Busca sempre a versão mais recente do localStorage
    sessaoAtiva = JSON.parse(localStorage.getItem('usuario_logado'));
    const userLogado = sessaoAtiva;
    
    if (userLogado) {
        leftSide.innerHTML = `<i data-lucide="user-check" style="color:var(--success)"></i> <span>Olá, ${userLogado.user}</span>`;

        // Exibe "Meus Pedidos" se estiver logado e NÃO estiver no painel admin
        const isAdminPage = window.location.href.includes('admin-produtos.html');
        if (pedidosBtn && !isAdminPage) {
            pedidosBtn.style.display = 'flex';
        } else if (pedidosBtn) {
            pedidosBtn.style.display = 'none';
        }
    } else {
        leftSide.innerHTML = `<i data-lucide="user-circle"></i> <span>Entrar / Cadastrar</span>`;
        if (pedidosBtn) pedidosBtn.style.display = 'none';
    }
    lucide.createIcons();
};

window.abrirMeusPedidos = function() {
    const userLogado = JSON.parse(localStorage.getItem('usuario_logado'));
    if (!userLogado) return;

    const historico = JSON.parse(localStorage.getItem('historico_vendas')) || [];
    const meusPedidos = historico.filter(p => p.usuario === userLogado.user);
    
    const lista = document.getElementById('lista-meus-pedidos');
    if (!lista) return;

    if (meusPedidos.length === 0) {
        lista.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding: 20px;">Você ainda não realizou pedidos.</p>';
    } else {
        lista.innerHTML = meusPedidos.reverse().map(p => `
            <li style="flex-direction: column; align-items: flex-start; gap: 5px;">
                <div style="display:flex; justify-content: space-between; width: 100%;">
                    <small style="color: var(--text-muted)">${p.data}</small>
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
    sessaoAtiva = JSON.parse(localStorage.getItem('usuario_logado'));
    const modal = document.getElementById('modal-auth');
    const authForm = document.getElementById('form-auth-dynamic');
    const switchMode = modal.querySelector('.auth-mode-switch');
    const logoutArea = document.getElementById('btn-logout-area');
    const submitBtn = document.getElementById('btn-auth-submit');
    const inputs = authForm.querySelectorAll('.form-group');
    const title = document.getElementById('auth-modal-title');

    if (sessaoAtiva) {
        title.innerHTML = `
            <div style="text-align:center; padding: 10px 0;">
                <div style="font-size: 0.9rem; color: var(--text-muted); font-weight: 500;">Logado como</div>
                <div style="font-size: 1.4rem; margin-top: 5px; color: var(--text-main); font-weight: 800;">${sessaoAtiva.user}</div>
                <div class="badge ${sessaoAtiva.role === 'restaurante' ? 'available' : 'featured'}" style="margin-top: 10px; display: inline-block;">
                    ${sessaoAtiva.role === 'restaurante' ? '👨‍🍳 Proprietário' : '🛍️ Cliente'}
                </div>
            </div>`;
        
        if (switchMode) switchMode.style.display = 'none';
        inputs.forEach(group => group.style.display = 'none');
        logoutArea.style.display = 'block';
        submitBtn.style.display = 'none';
        if (modal) modal.classList.add('is-logged-in');
    } else {
        title.innerText = "Acesse sua conta";
        if (switchMode) switchMode.style.display = 'flex';
        inputs.forEach(group => group.style.display = 'block');
        logoutArea.style.display = 'none';
        submitBtn.style.display = 'block';
        if (modal) modal.classList.remove('is-logged-in');
        setAuthMode('login');
    }
    
    openModal('modal-auth');
};

window.setAuthMode = function(mode) {
    currentAuthMode = mode;
    if (!document.getElementById('btn-mode-login')) return;
    
    // Só aplica a lógica visual de troca se não estiver logado
    if (JSON.parse(localStorage.getItem('usuario_logado'))) return;

    document.getElementById('btn-mode-login').classList.toggle('active', mode === 'login');
    document.getElementById('btn-mode-register').classList.toggle('active', mode === 'register');
    document.getElementById('group-role').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('btn-auth-submit').innerText = mode === 'login' ? 'Entrar' : 'Cadastrar agora';
};

window.processarAuth = function(e) {
    e.preventDefault();
    const user = document.getElementById('auth-user').value;
    const pass = document.getElementById('auth-pass').value;
    const role = document.getElementById('auth-role').value;
    
    let usuarios = JSON.parse(localStorage.getItem('usuarios_app')) || [];

    if (currentAuthMode === 'register') {
        if (usuarios.find(u => u.user === user)) return showToast('Usuário já existe!', 'error');
        const novo = { user, pass, role };
        usuarios.push(novo);
        localStorage.setItem('usuarios_app', JSON.stringify(usuarios));
        localStorage.setItem('usuario_logado', JSON.stringify(novo));
        showToast('Conta criada!');
    } else {
        const valid = usuarios.find(u => u.user === user && u.pass === pass);
        if (!valid) return showToast('Usuário ou senha incorretos', 'error');
        localStorage.setItem('usuario_logado', JSON.stringify(valid));
        showToast('Bem-vindo de volta!');
    }

    // REFORMULAÇÃO: Atualiza a sessão ativa globalmente
    sessaoAtiva = JSON.parse(localStorage.getItem('usuario_logado'));

    // Fluxo de interface após login
    if (sessaoAtiva.role === 'restaurante') {
        if (window.location.href.includes('admin-produtos.html')) {
            document.body.classList.remove('is-locked');
            closeModal('modal-auth');
            renderizarHeaderAdmin();
            atualizarListaAdmin();
            atualizarRelatorio();
            atualizarTopoNav();
        } else {
            window.location.href = 'admin-produtos.html';
        }
    } else {
        closeModal('modal-auth');
        atualizarTopoNav();
        // Se estiver na index, atualiza pontos
        if (typeof window.atualizarPontosUI === 'function') window.atualizarPontosUI();
    }
};

/**
 * Inicialização Robusta
 */
function inicializarSistema() {
    // Garante que a sessão esteja sincronizada antes de qualquer lógica
    sessaoAtiva = JSON.parse(localStorage.getItem('usuario_logado'));

    // 1. Atualiza a navegação superior (Nome do usuário, etc) em todas as páginas
    atualizarTopoNav();

    // 2. Verifica se a página atual exige login de restaurante
    const isAdminPage = window.location.href.includes('admin-produtos.html');
    
    if (isAdminPage) {
        verificarProtecaoAdmin();
        
        // Se estiver logado corretamente no admin, carrega os dados
        if (sessaoAtiva && sessaoAtiva.role === 'restaurante') {
            // Garante que o painel comece na Visão Geral
            showSection('dashboard');
            
            // Popula os dados do restaurante
            renderizarHeaderAdmin();
            atualizarListaAdmin();
            atualizarRelatorio();
            atualizarSelectCategorias();
        }
    }
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

function carregarLeads() {
    if (!sessaoAtiva || !sessaoAtiva.user) return [];
    return JSON.parse(localStorage.getItem(`leads_${sessaoAtiva.user}`)) || [];
}

function carregarConfiguracoesRestaurante() {
    if (!sessaoAtiva || !sessaoAtiva.user) return {};
    const todasConfigs = JSON.parse(localStorage.getItem('configs_restaurantes')) || {};
    return todasConfigs[sessaoAtiva.user] || {};
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
function atualizarListaAdmin() {
    if (!sessaoAtiva || sessaoAtiva.role !== 'restaurante') return;
    
    const listaAdmin = document.getElementById('lista-admin');
    if (!listaAdmin) return;

    const produtosGlobais = JSON.parse(localStorage.getItem('meus_produtos')) || [];
    // Filtra apenas os produtos que pertencem ao restaurante logado
    const meusProdutos = produtosGlobais.filter(p => p.owner === sessaoAtiva.user);
    
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
    
    const arquivoImagem = document.getElementById('imagem').files[0];
    let imagemData = document.getElementById('imagemBase64').value;

    // Se um novo arquivo foi selecionado, converte ele
    if (arquivoImagem) {
        imagemData = await toBase64(arquivoImagem);
    }
    
    const novoProduto = {
        id: editId || Date.now().toString(), // Mantém o ID ou cria um novo
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

    let produtos = JSON.parse(localStorage.getItem('meus_produtos')) || [];
    
    if (!editId) {
        // Modo de Cadastro
        produtos.push(novoProduto);
        showToast('Produto cadastrado com sucesso!');
    } else {
        // Modo de Edição
        const indexGlobal = produtos.findIndex(p => p.id === editId);
        if (indexGlobal !== -1) produtos[indexGlobal] = novoProduto;
        editId = null; 
        document.getElementById('btnSalvar').innerText = 'Cadastrar Produto';
        showToast('Produto atualizado com sucesso!');
    }

    localStorage.setItem('meus_produtos', JSON.stringify(produtos));

    e.target.reset();
    document.getElementById('imagemBase64').value = '';
    atualizarListaAdmin();
    closeModal('modal-produto');
});

// Função para carregar dados no formulário para edição
window.editarProduto = function(id) {
    const produtos = JSON.parse(localStorage.getItem('meus_produtos')) || [];
    const prod = produtos.find(p => p.id === id);

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

window.promptNovaCategoria = function() {
    const nova = prompt("Digite o nome da nova categoria:");
    if (nova && nova.trim() !== "") {
        const todasConfigs = JSON.parse(localStorage.getItem('configs_restaurantes')) || {};
        const config = todasConfigs[sessaoAtiva.user] || {};
        
        let existentes = config.categorias_custom || "";
        if (existentes.includes(nova)) return showToast("Esta categoria já existe!", "error");
        
        config.categorias_custom = existentes ? `${existentes}, ${nova}` : nova;
        todasConfigs[sessaoAtiva.user] = config;
        
        localStorage.setItem('configs_restaurantes', JSON.stringify(todasConfigs));
        atualizarSelectCategorias();
        document.getElementById('categoria').value = nova;
        showToast(`Categoria "${nova}" adicionada!`);
    }
};

// Relatório de Vendas
function atualizarRelatorio() {
    if (!sessaoAtiva) return;

    const historicoGlobal = JSON.parse(localStorage.getItem('historico_vendas')) || [];
    const meuHistorico = historicoGlobal.filter(venda => venda.restauranteOwner === sessaoAtiva.user);

    const totalPedidos = meuHistorico.length;
    const totalFaturamento = meuHistorico.reduce((sum, pedido) => sum + pedido.total, 0);

    document.getElementById('report-pedidos').innerText = totalPedidos;
    document.getElementById('report-faturamento').innerText = `R$ ${totalFaturamento.toFixed(2)}`;

    const listaPedidos = document.getElementById('lista-pedidos-historico');
    if (listaPedidos) {
        if (meuHistorico.length === 0) {
            listaPedidos.innerHTML = '<p class="loading">Nenhum pedido registrado ainda.</p>';
            return;
        }
        let html = '<div style="overflow-x: auto;"><table style="width:100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: var(--shadow-sm);">';
        html += '<tr style="background: #f8fafc; text-align: left;"><th style="padding:12px;">Data</th><th style="padding:12px;">Cliente</th><th style="padding:12px;">Itens</th><th style="padding:12px;">Total</th><th style="padding:12px;">Ações</th></tr>';
        
        // Mostrar os últimos 10 pedidos
        meuHistorico.slice(-10).reverse().forEach(ped => {
            html += `<tr style="border-top: 1px solid #f1f5f9;">
                <td style="padding:12px; font-size: 0.85rem;">${ped.data}</td>
                <td style="padding:12px; font-weight: bold;">${ped.cliente}</td>
                <td style="padding:12px; font-size: 0.85rem; color: var(--text-muted);">${ped.itens.join(', ')}</td>
                <td style="padding:12px; font-weight: bold; color: var(--success);">R$ ${parseFloat(ped.total).toFixed(2)}</td>
                <td style="padding:12px;"><button onclick="imprimirPedido(${ped.id})" class="btn-print">🖨️ Imprimir</button></td>
            </tr>`;
        });
        html += '</table></div>';
        listaPedidos.innerHTML = html;
    }
}

window.imprimirPedido = function(id) {
    const historico = JSON.parse(localStorage.getItem('historico_vendas')) || [];
    const ped = historico.find(p => p.id === id);
    if (!ped) return;

    const janelaImpressao = window.open('', '', 'width=350,height=600');
    janelaImpressao.document.write(`
        <html>
            <head><title>Ticket de Cozinha</title></head>
            <body style="font-family: 'Courier New', monospace; padding: 5mm; width: 80mm; font-size: 13px; line-height: 1.2;">
                <div style="text-align:center; font-weight:bold; font-size: 16px;">*** MEU RESTAURANTE ***</div>
                <div style="text-align:center; margin-bottom: 5px;">-------------------------------</div>
                <div><b>PEDIDO:</b> #${ped.id.toString().slice(-4)}</div>
                <div><b>DATA:</b> ${ped.data}</div>
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

window.limparHistoricoVendas = function() {
    if(confirm('Deseja realmente zerar o relatório de vendas?')) {
        localStorage.removeItem('historico_vendas');
        atualizarRelatorio();
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
        const base64 = await toBase64(file);
        const todasConfigs = JSON.parse(localStorage.getItem('configs_restaurantes')) || {};
        const config = todasConfigs[sessaoAtiva.user] || {};

        config[campo] = base64;
        todasConfigs[sessaoAtiva.user] = config;
        
        localStorage.setItem('configs_restaurantes', JSON.stringify(todasConfigs));
        showToast('Imagem atualizada!');
        renderizarHeaderAdmin();
    } catch (err) {
        showToast('Erro ao carregar imagem', 'error');
    }
};

function salvarConfigRapida(campo, valor) {
    const todasConfigs = JSON.parse(localStorage.getItem('configs_restaurantes')) || {};
    const config = todasConfigs[sessaoAtiva.user] || {};

    if (campo === 'nome') config.nome_exibicao = valor;
    if (campo === 'descricao') config.descricao_loja = valor;
    if (campo === 'tempo') {
        // Garante que salve com o sufixo "min" apenas se o usuário não digitar
        let val = valor.toLowerCase().includes('min') ? valor : valor + ' min';
        config.tempo_entrega = val;
    }
    if (campo === 'horario') {
        // Tenta quebrar "18h - 23h" ou "18-23"
        const partes = valor.replace(/h/g, '').split(/[-–]/);
        if (partes.length === 2) {
            config.abertura = partes[0].trim();
            config.fechamento = partes[1].trim();
        }
    }

    todasConfigs[sessaoAtiva.user] = config;
    localStorage.setItem('configs_restaurantes', JSON.stringify(todasConfigs));
    showToast('Atualizado!');
}

function renderizarHeaderAdmin() {
    if (!sessaoAtiva || sessaoAtiva.role !== 'restaurante') return;
    
    const config = carregarConfiguracoesRestaurante();
    const nomeEl = document.getElementById('admin-nome-loja');
    if (!nomeEl) return; // Segurança para não rodar fora da página admin

    nomeEl.innerText = config.nome_exibicao || sessaoAtiva.user;
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
        linkEl.innerText = `${urlBase}index.html?loja=${sessaoAtiva.user}`;
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
const configForm = document.getElementById('configLojaForm');
if (configForm) {
    const lojaFechadaManualmente = document.getElementById('lojaFechadaManualmente');
    const inputFreteGratis = document.getElementById('inputFreteGratis');
    const inputPedidoMinimo = document.getElementById('inputPedidoMinimo');
    const inputWhatsapp = document.getElementById('inputWhatsapp');
    const inputPix = document.getElementById('inputPix');
    const inputTaxa = document.getElementById('inputTaxa');
    const inputCupons = document.getElementById('inputCupons');
    const inputCategoriasCustom = document.getElementById('inputCategoriasCustom');
    const inputBanners = document.getElementById('inputBanners');
    const inputLogo = document.getElementById('inputLogo');

    const configAtual = carregarConfiguracoesRestaurante();

    // Carregar valores iniciais
    if (configAtual.logo && document.getElementById('logo-admin')) {
        const logoAdmin = document.getElementById('logo-admin');
        logoAdmin.src = configAtual.logo;
        logoAdmin.style.display = 'block';
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
            categorias_custom: inputCategoriasCustom.value,
        };

        const arquivoLogo = inputLogo.files[0];
        if (arquivoLogo) {
            novasConfigs.logo = await toBase64(arquivoLogo);
        }
        
        const arquivosBanners = document.getElementById('inputBanners').files;
        if (arquivosBanners.length > 0) {
            const promises = Array.from(arquivosBanners).map(file => toBase64(file));
            novasConfigs.banners = await Promise.all(promises);
        }
        
        const todasConfigs = JSON.parse(localStorage.getItem('configs_restaurantes')) || {};
        todasConfigs[sessaoAtiva.user] = novasConfigs;
        localStorage.setItem('configs_restaurantes', JSON.stringify(todasConfigs));

        showToast('Configurações salvas!');
        renderizarHeaderAdmin();
        atualizarSelectCategorias();
    });
}

function atualizarSelectCategorias() {
    const select = document.getElementById('categoria');
    if (!select) return;
    
    const config = carregarConfiguracoesRestaurante();
    const categoriasPadrao = ['Lanches', 'Pizzas', 'Acompanhamentos', 'Bebidas', 'Sobremesas', 'Outros'];
    const customStr = config.categorias_custom || "";
    const custom = customStr.split(',').map(c => c.trim()).filter(c => c !== "");
    
    const todas = [...new Set([...categoriasPadrao, ...custom])];
    
    const valorAtual = select.value;
    select.innerHTML = todas.map(c => `<option value="${c}">${c}</option>`).join('');
    if (todas.includes(valorAtual)) select.value = valorAtual;
}

// Excluir produto
window.excluirProduto = function(id) {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        let produtos = JSON.parse(localStorage.getItem('meus_produtos')) || [];
        produtos = produtos.filter(p => p.id !== id);
        localStorage.setItem('meus_produtos', JSON.stringify(produtos));
        atualizarListaAdmin();
    }
};