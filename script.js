const formProduto = document.getElementById('cadastroProdutoForm');
const listaAdmin = document.getElementById('lista-admin');
let editId = null; // Agora usamos ID em vez de Index para evitar erros em listas filtradas

const sessaoAtiva = JSON.parse(localStorage.getItem('usuario_logado'));

function logout() {
    localStorage.removeItem('usuario_logado');
    window.location.href = 'login.html';
}

window.openModal = function(id) {
    document.getElementById(id).style.display = 'flex';
    document.body.classList.add('no-scroll');
}

window.closeModal = function(id) {
    document.getElementById(id).style.display = 'none';
    document.body.classList.remove('no-scroll');
    if (id === 'modal-produto') {
        editId = null;
        formProduto.reset();
        document.getElementById('modal-titulo').innerText = 'Novo Produto';
        document.getElementById('btnSalvar').innerText = 'Cadastrar Produto';
    }
}

// Fechar modal ao clicar fora (no fundo) - Admin
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        window.closeModal(event.target.id);
    }
});

window.showSection = function(sectionId) {
    document.getElementById('section-dashboard').style.display = 'none';
    document.getElementById('section-cardapio').style.display = 'none';
    document.getElementById('section-' + sectionId).style.display = 'block';
    
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.getElementById('nav-' + sectionId).classList.add('active');
}

function carregarLeads() {
    if (!sessaoAtiva) return [];
    return JSON.parse(localStorage.getItem(`leads_${sessaoAtiva.user}`)) || [];
}

function carregarConfiguracoesRestaurante() {
    if (!sessaoAtiva) return {};
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
    if (!sessaoAtiva) return;
    
    const produtosGlobais = JSON.parse(localStorage.getItem('meus_produtos')) || [];
    // Filtra apenas os produtos que pertencem ao restaurante logado
    const meusProdutos = produtosGlobais.filter(p => p.owner === sessaoAtiva.user);
    
    listaAdmin.innerHTML = '';

    meusProdutos.forEach((prod) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img src="${prod.imagem || 'https://via.placeholder.com/300x180?text=Sem+Foto'}" style="width:100%; height:180px; object-fit:cover; border-radius:8px;">
            <div style="display: flex; flex-direction: column; flex-grow: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="badge">${prod.categoria || 'Geral'}</span>
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
}

// Salvar novo produto
formProduto.addEventListener('submit', async (e) => {
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

    formProduto.reset();
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

    editId = id;
    document.getElementById('modal-titulo').innerText = 'Editar Produto';
    document.getElementById('btnSalvar').innerText = 'Salvar Alterações';
    openModal('modal-produto');
};

// Relatório de Vendas
function atualizarRelatorio() {
    if (!sessaoAtiva) return;

    const historicoGlobal = JSON.parse(localStorage.getItem('historico_vendas')) || [];
    const meuHistorico = historicoGlobal.filter(venda => venda.restauranteOwner === sessaoAtiva.user);

    const totalPedidos = meuHistorico.length;
    const totalFaturamento = meuHistorico.reduce((sum, pedido) => sum + pedido.total, 0);

    // Atualizar dados de marketing
    const leads = carregarLeads();
    const leadsCount = document.getElementById('marketing-leads-count');
    if(leadsCount) leadsCount.innerText = leads.length;
    
    const listaLeads = document.getElementById('lista-leads-vip');
    if(listaLeads) {
        listaLeads.innerHTML = leads.length ? leads.map(l => `
            <div style="padding: 8px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                <span>${l.nome}</span>
                <b>${l.whatsapp}</b>
            </div>
        `).join('') : '<p style="color:var(--text-muted)">Nenhum cliente cadastrado.</p>';
    }

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

// Lógica para Configurações da Loja (Integrada ao Script Principal)
const configForm = document.getElementById('configLojaForm');
if (configForm) {
    const inputAbertura = document.getElementById('inputAbertura');
    const inputFechamento = document.getElementById('inputFechamento');
    const lojaFechadaManualmente = document.getElementById('lojaFechadaManualmente');
    const inputFreteGratis = document.getElementById('inputFreteGratis');
    const inputPedidoMinimo = document.getElementById('inputPedidoMinimo');
    const inputWhatsapp = document.getElementById('inputWhatsapp');
    const inputPix = document.getElementById('inputPix');
    const inputTaxa = document.getElementById('inputTaxa');
    const inputCupons = document.getElementById('inputCupons');
    const inputCorPrincipal = document.getElementById('inputCorPrincipal');
    const inputBanners = document.getElementById('inputBanners');
    const inputTempo = document.getElementById('inputTempo');
    const inputLogo = document.getElementById('inputLogo');

    const configAtual = carregarConfiguracoesRestaurante();

    // Carregar valores iniciais
    if (configAtual.logo && document.getElementById('logo-admin')) {
        const logoAdmin = document.getElementById('logo-admin');
        logoAdmin.src = configAtual.logo;
        logoAdmin.style.display = 'block';
    }
    
    inputAbertura.value = configAtual.abertura || 18;
    inputFechamento.value = configAtual.fechamento || 23;
    inputFreteGratis.value = configAtual.frete_gratis_valor || "";
    lojaFechadaManualmente.checked = configAtual.fechada_manualmente === true;
    inputPedidoMinimo.value = configAtual.pedido_minimo || "";
    inputWhatsapp.value = configAtual.whatsapp || "";
    inputPix.value = configAtual.pix || "";
    inputTaxa.value = configAtual.taxa_entrega || 5.00;
    inputTempo.value = configAtual.tempo_entrega || "30-50";

    configForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const novasConfigs = {
            abertura: inputAbertura.value,
            fechamento: inputFechamento.value,
            fechada_manualmente: lojaFechadaManualmente.checked,
            frete_gratis_valor: inputFreteGratis.value,
            pedido_minimo: inputPedidoMinimo.value,
            whatsapp: inputWhatsapp.value,
            pix: inputPix.value,
            taxa_entrega: inputTaxa.value,
            cupons: inputCupons.value,
            cor_principal: inputCorPrincipal.value,
            tempo_entrega: inputTempo.value,
            banners: configAtual.banners || [],
            logo: configAtual.logo || ""
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
        closeModal('modal-config');
    });
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

atualizarListaAdmin();
atualizarRelatorio();