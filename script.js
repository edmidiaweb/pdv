/* ========================================================================== */
/* CONFIGURAÇÃO DO CLIENTE SUPABASE (Nuvem Multi-Tenant)                      */
/* ========================================================================== */
const SUPABASE_URL = 'SUA_URL_DO_SUPABASE_AQUI';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON_DO_SUPABASE_AQUI';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EMAIL_ADMIN_MESTRE = "admin@sistemagestao.com"; // Substitua pelo seu e-mail master

let estoque = [];
let vendas = [];
let clientes = [];
let orcamentos = [];

let carrinho = [];
let ajuste = 0;
let clienteSelecionadoId = null;
let orcamentoSelecionadoParaVenda = null;

const taxasPagamento = { 'dinheiro': 0, 'pix': 0.5, 'debito': 2, 'credito': 5 };

function arredondarParaCima(valor) { return Math.ceil(valor * 100) / 100; }

function mostrarAlerta(msg, err=false){ 
    let d = document.createElement('div'); 
    d.className = 'alerta' + (err ? ' alerta-erro' : ''); 
    d.innerText = msg; 
    document.body.appendChild(d); 
    setTimeout(() => d.remove(), 2500); 
}

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("ativo");
}

/* ========================================================================== */
/* AUTENTICAÇÃO E CONTROLE DE PERMISSÕES                                      */
/* ========================================================================== */
async function fazerLogin() {
    let email = document.getElementById("loginUser").value.trim();
    let pass = document.getElementById("loginPass").value;

    if(!email || !pass) { alert("⚠️ Preencha e-mail e senha!"); return; }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });

    if (error) { alert("❌ Erro ao autenticar: " + error.message); return; }

    sessionStorage.setItem("_current_user", data.user.email);
    sessionStorage.setItem("_user_id", data.user.id);
    
    document.getElementById("loginModal").style.display = "none";
    document.getElementById("sidebar").style.display = "flex";
    document.getElementById("main").style.display = "block";
    
    await verificarSeEhAdmin(data.user.email);
    await carregarDadosDaNuvem();
    atualizarTela();
}

async function verificarSeEhAdmin(email) {
    if (email === EMAIL_ADMIN_MESTRE) {
        document.getElementById("btnAdmin").style.display = "flex";
        carregarListaLojasAdmin();
    }
}

function logout(){ 
    supabaseClient.auth.signOut();
    sessionStorage.clear(); 
    location.reload(); 
}

function abrirAba(id){ 
    document.querySelectorAll(".aba").forEach(a => a.classList.remove("ativa")); 
    document.getElementById(id).classList.add("ativa"); 
    if(window.innerWidth <= 900) document.getElementById("sidebar").classList.remove("ativo");
    if(id === 'historico') carregarHistoricoVendas(); 
    if(id === 'estoque') atualizarTabelaEstoque(estoque); 
    if(id === 'relatorios') atualizarDashboard();
}

/* ========================================================================== */
/* CARREGAMENTO DE DADOS DO SUPABASE                                          */
/* ========================================================================== */
async function carregarDadosDaNuvem() {
    let { data: prodData } = await supabaseClient.from('produtos').select('*');
    if(prodData) estoque = prodData;

    let { data: cliData } = await supabaseClient.from('clientes').select('*');
    if(cliData) clientes = cliData;

    let { data: vendData } = await supabaseClient.from('vendas').select('*');
    if(vendData) vendas = vendData;
}

/* ========================================================================== */
/* PAINEL ADMINISTRATIVO (SUPER ADMIN)                                        */
/* ========================================================================== */
async function cadastrarNovoComercio() {
    let email = document.getElementById("novoAdminEmail").value.trim();
    let password = document.getElementById("novoAdminPass").value.trim();
    let nomeLoja = document.getElementById("novoAdminLoja").value.trim();

    if (!email || !password || !nomeLoja) { alert("⚠️ Preencha todos os campos!"); return; }

    const { error } = await supabaseClient.auth.signUp({
        email, password, options: { data: { nome_loja: nomeLoja } }
    });

    if (error) { alert("❌ Erro: " + error.message); return; }

    mostrarAlerta("✅ Comércio cadastrado com sucesso!");
    document.getElementById("novoAdminEmail").value = "";
    document.getElementById("novoAdminPass").value = "";
    document.getElementById("novoAdminLoja").value = "";
    carregarListaLojasAdmin();
}

async function carregarListaLojasAdmin() {
    let tbody = document.getElementById("corpoListaLojas");
    if (!tbody) return;

    let { data, error } = await supabaseClient.from('perfis_lojas').select('*');
    if (error || !data) { tbody.innerHTML = `<tr><td colspan="3">Nenhuma loja cadastrada.</td></tr>`; return; }

    let html = '';
    for (let loja of data) {
        html += `<tr><td>${loja.nome_loja || 'Comércio'}</td><td>${loja.email}</td><td>---</td></tr>`;
    }
    tbody.innerHTML = html;
}

/* ========================================================================== */
/* PRODUTOS E ESTOQUE                                                         */
/* ========================================================================== */
function ordenarProdutosAlfabetico(produtos) {
    return [...produtos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

async function salvarProduto(){
    const userId = sessionStorage.getItem("_user_id");
    let cod = document.getElementById("codigoBarras").value.trim();
    let nome = document.getElementById("nome").value.trim();
    let compra = parseFloat(document.getElementById("compra").value);
    let venda = parseFloat(document.getElementById("venda").value);
    let qtd = parseInt(document.getElementById("quantidade").value);
    
    if(!nome || isNaN(compra) || isNaN(venda) || isNaN(qtd) || compra <= 0 || venda <= 0 || qtd <= 0){ 
        alert("Preencha corretamente!"); return; 
    }

    let novoProduto = { user_id: userId, codigoBarra: cod || null, nome, compra, venda, quantidade: qtd };
    let { data, error } = await supabaseClient.from('produtos').insert([novoProduto]).select();
    
    if(error){ alert("Erro ao salvar: " + error.message); return; }
    if(data) estoque.push(data[0]);

    document.getElementById("codigoBarras").value = ""; 
    document.getElementById("nome").value = ""; 
    document.getElementById("compra").value = ""; 
    document.getElementById("venda").value = ""; 
    document.getElementById("quantidade").value = "";
    
    atualizarTabelaEstoque(estoque); 
    atualizarDashboard(); 
    mostrarAlerta("✅ Produto salvo!");
}

function atualizarTabelaEstoque(produtosParaExibir){
    let tbody = document.getElementById("corpoEstoque"); 
    if(!tbody) return;
    
    const produtosOrdenados = ordenarProdutosAlfabetico(produtosParaExibir);
    if(!produtosOrdenados.length){ tbody.innerHTML = '<tr><td colspan="7">Nenhum produto encontrado</td></tr>'; return; }
    
    let html = '';
    for(let p of produtosOrdenados){
        let lucroUnit = p.venda - p.compra;
        html += `<tr>
            <td>${p.codigoBarra || p.codigoBarras || '---'}</td>
            <td>${p.nome}</td>
            <td>R$ ${p.compra.toFixed(2)}</td>
            <td>R$ ${p.venda.toFixed(2)}</td>
            <td>${p.quantidade}</td>
            <td class="${lucroUnit >= 0 ? 'lucro' : 'prejuizo'}">R$ ${lucroUnit.toFixed(2)}</td>
            <td><button class="excluir" onclick="excluirProduto('${p.id}')" style="width:auto; padding:6px;">🗑️</button></td>
        </tr>`;
    }
    tbody.innerHTML = html;
}

async function excluirProduto(id){ 
    if(confirm("Excluir produto?")){ 
        let { error } = await supabaseClient.from('produtos').delete().eq('id', id);
        if(!error){
            estoque = estoque.filter(p => p.id != id); 
            atualizarTabelaEstoque(estoque); 
            mostrarAlerta("Produto excluído.");
        }
    } 
}

/* ========================================================================== */
/* CLIENTES                                                                   */
/* ========================================================================== */
async function salvarCliente(){
    const userId = sessionStorage.getItem("_user_id");
    let nome = document.getElementById("clienteNome").value.trim(); 
    if(!nome){ alert("Nome obrigatório"); return; }
    
    let novoCliente = { 
        user_id: userId, nome, 
        telefone: document.getElementById("clienteTelefone").value, 
        cpf: document.getElementById("clienteCpf").value, 
        endereco: document.getElementById("clienteEndereco").value 
    };

    let { data, error } = await supabaseClient.from('clientes').insert([novoCliente]).select();
    if(error){ alert("Erro: " + error.message); return; }
    if(data) clientes.push(data[0]);

    atualizarListaClientes(); 
    mostrarAlerta("✅ Cliente salvo!");
    document.getElementById("clienteNome").value = ""; 
    document.getElementById("clienteTelefone").value = ""; 
    document.getElementById("clienteCpf").value = ""; 
    document.getElementById("clienteEndereco").value = "";
}

function atualizarListaClientes(filtro = ""){
    let div = document.getElementById("listaClientes"); 
    if(!div) return;
    let filtrados = filtro ? clientes.filter(c => c.nome.toLowerCase().includes(filtro.toLowerCase())) : clientes;
    if(!filtrados.length){ div.innerHTML = "<p>Nenhum cliente encontrado</p>"; return; }
    div.innerHTML = filtrados.map(c => `<div class="cliente-item"><strong>${c.nome}</strong><br>📞 ${c.telefone || '---'} | 🆔 ${c.cpf || '---'}</div>`).join('');
}

/* ========================================================================== */
/* VENDAS E PDV                                                               */
/* ========================================================================== */
function calcularTaxa(){
    let totalComAjuste = parseFloat(document.getElementById("totalComAjuste").innerText) || 0;
    let pagamento = document.getElementById("pagamento").value;
    let taxaPercentual = taxasPagamento[pagamento] || 0;
    let taxaValor = arredondarParaCima((totalComAjuste * taxaPercentual) / 100);
    let valorLiquido = totalComAjuste - taxaValor;
    
    let taxaInfo = document.getElementById("taxaInfo");
    if(taxaPercentual > 0){
        taxaInfo.style.display = "block";
        document.getElementById("taxaPercentual").innerText = `${taxaPercentual}%`;
        document.getElementById("taxaValor").innerText = taxaValor.toFixed(2);
        document.getElementById("valorLiquido").innerHTML = `R$ ${valorLiquido.toFixed(2)}`;
    } else {
        taxaInfo.style.display = "none";
    }
    return { taxaPercentual, taxaValor, valorLiquido };
}

function adicionarAoCarrinho(produto, quantidade=1){
    if(produto.quantidade < quantidade){ mostrarAlerta(`Estoque insuficiente!`, true); return false; }
    carrinho.push({ 
        id: produto.id, nome: produto.nome, qtd: quantidade, 
        precoVenda: produto.venda, precoCompra: produto.compra, 
        subtotalVenda: produto.venda * quantidade, subtotalCompra: produto.compra * quantidade 
    });
    atualizarCarrinho(); 
    return true;
}

function atualizarCarrinho(){
    let div = document.getElementById("carrinho"); 
    if(!div) return;
    let total = 0, html = '';
    for(let idx = 0; idx < carrinho.length; idx++){ 
        let item = carrinho[idx]; 
        total += item.subtotalVenda; 
        html += `<div class="carrinho-item"><span>📌 <strong>${item.nome}</strong> (${item.qtd}x R$ ${item.precoVenda.toFixed(2)})</span><button class="excluir" onclick="carrinho.splice(${idx},1);atualizarCarrinho();" style="width:auto; padding:4px 8px;">❌</button></div>`; 
    }
    div.innerHTML = html;
    document.getElementById("totalVenda").innerText = total.toFixed(2); 
    document.getElementById("totalComAjuste").innerText = (total + ajuste).toFixed(2);
    calcularTaxa();
    calcularTroco();
}

function aplicarAjuste(){ ajuste = parseFloat(document.getElementById("ajusteValor").value) || 0; atualizarCarrinho(); }
function calcularTroco(){ 
    let total = parseFloat(document.getElementById("totalComAjuste").innerText) || 0; 
    let pago = parseFloat(document.getElementById("valorPago").value) || 0; 
    document.getElementById("displayTroco").innerHTML = `Troco: R$ ${(pago - total > 0 ? pago - total : 0).toFixed(2)}`; 
}

async function finalizarVenda(){
    const userId = sessionStorage.getItem("_user_id");
    if(!carrinho.length){ alert("Carrinho vazio!"); return; }
    
    let totalComAjuste = carrinho.reduce((acc, i) => acc + i.subtotalVenda, 0) + ajuste;
    let custoTotal = carrinho.reduce((acc, i) => acc + i.subtotalCompra, 0);
    let taxaData = calcularTaxa();
    
    let clienteNome = clienteSelecionadoId ? (clientes.find(c => c.id == clienteSelecionadoId)?.nome || "Cliente") : "Não identificado";
    
    let novaVenda = {
        user_id: userId, data_str: new Date().toLocaleString("pt-BR"),
        cliente_nome: clienteNome, pagamento: document.getElementById("pagamento").value,
        total_final: totalComAjuste, lucro_liquido: (taxaData.valorLiquido - custoTotal), itens: carrinho
    };

    let { data, error } = await supabaseClient.from('vendas').insert([novaVenda]).select();
    if(error){ alert("Erro ao finalizar venda: " + error.message); return; }
    if(data) vendas.push(data[0]);

    carrinho = []; ajuste = 0; atualizarCarrinho();
    document.getElementById("valorPago").value = ""; document.getElementById("ajusteValor").value = "";
    atualizarDashboard(); carregarHistoricoVendas();
    mostrarAlerta(`✅ Venda finalizada com sucesso!`);
}

function carregarHistoricoVendas(){
    let tbody = document.getElementById("corpoHistorico"); 
    if(!tbody) return;
    if(!vendas.length){ tbody.innerHTML = '<tr><td colspan="5">Nenhuma venda registrada</td></tr>'; return; }
    tbody.innerHTML = [...vendas].reverse().map(v => `<tr><td>${v.data_str}</td><td>${v.cliente_nome}</td><td>${v.pagamento}</td><td>R$ ${(v.total_final || 0).toFixed(2)}</td><td>R$ ${(v.lucro_liquido || 0).toFixed(2)}</td></tr>`).join('');
    document.getElementById("totalPeriodo").innerText = vendas.reduce((s, v) => s + (v.total_final || 0), 0).toFixed(2);
}

function atualizarDashboard(){
    document.getElementById("quantidadeVendas").innerText = vendas.length;
    document.getElementById("totalProdutos").innerText = estoque.length;
}

function backup(){ 
    let blob = new Blob([JSON.stringify({ estoque, vendas, clientes }, null, 2)]); 
    let a = document.createElement("a"); a.href = URL.createObjectURL(blob); 
    a.download = `backup_${new Date().toISOString().split('T')[0]}.json`; a.click(); 
}

function atualizarTela() { atualizarTabelaEstoque(estoque); atualizarListaClientes(); atualizarDashboard(); }

// Autocompletes e Eventos
window.addEventListener('load', () => {
    let inputProd = document.getElementById("inputPesquisaProdutoVenda");
    if(inputProd) inputProd.addEventListener("input", (e) => {
        let termo = e.target.value.toLowerCase();
        let resDiv = document.getElementById("resultadosAutocompleteVenda");
        if(!termo) { resDiv.style.display = "none"; return; }
        let filtrados = estoque.filter(p => p.nome.toLowerCase().includes(termo));
        resDiv.innerHTML = filtrados.map(p => `<div class="resultado-item" onclick="adicionarAoCarrinho(estoque.find(x=>x.id==${p.id}));document.getElementById('resultadosAutocompleteVenda').style.display='none';document.getElementById('inputPesquisaProdutoVenda').value='';"><span>${p.nome} (R$ ${p.venda.toFixed(2)})</span></div>`).join('');
        resDiv.style.display = "block";
    });
});