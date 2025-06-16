// Funções de utilidade
// Uma sequência de caracteres simples que não diferencia maiúsculas de minúsculas
function strContains(haystack, needle) {
    return haystack.toLowerCase().includes(needle.toLowerCase());
}

// Auxiliar de formatação de data
function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
		year: 'numeric', month: 'short', day: 'numeric',
		hour: 'numeric', minute: '2-digit'
	});
}

// Codificador SHA-256 para hash de senha (assíncrono)
async function sha256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validar nome de usuário (letras, números, sublinhados, 3-20 caracteres)
function isValidUsername(username) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

// Validar senha (mínimo 8 caracteres)
function isValidPassword(password) {
    return password.length >= 8;
}

// Escape HTML (para prevenção de XSS)
function escapeHtml(text) {
    const p = document.createElement('p');
    p.textContent = text;
    return p.innerHTML;
}

// Chaves de armazenamento
const USERS_KEY = 'blogbishop-users';
const POSTS_KEY = 'blogbishop-posts';
const SESSION_KEY = 'blogbishop-session-user';

// Estado
let currentUser = null;
let posts = [];
let filteredPosts = [];
let isRegister = false;
let users = [];
let editingPostId = null;

// Elementos DOM
const authSection = document.getElementById('auth-section');
const authFormContainer = document.getElementById('auth-form-container');
const authForm = document.getElementById('auth-form');
const authFormTitle = document.getElementById('auth-form-title');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authSwitch = document.getElementById('auth-switch');
const authMessage = document.getElementById('auth-message');

const appSection = document.getElementById('app');
const postTitleInput = document.getElementById('post-title');
const postContentInput = document.getElementById('post-content');
const previewArea = document.getElementById('preview-area');
const createPostBtn = document.getElementById('create-post-btn');

const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear');
const postsList = document.getElementById('posts-list');
const noPostsMsg = document.getElementById('no-posts-msg');

// Inicialização
function loadUsers() {
    try {
		return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
		} catch {
		return [];
	}
}
function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadPosts() {
    try {
		return JSON.parse(localStorage.getItem(POSTS_KEY) || '[]');
		} catch {
		return [];
	}
}
function savePosts(posts) {
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
}

function loadSession() {
    try {
		return JSON.parse(localStorage.getItem(SESSION_KEY));
		} catch {
		return null;
	}
}
function saveSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}
function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// Renderização de postagens
function renderPosts(postArray) {
    postsList.innerHTML = '';
    if (postArray.length === 0) {
		noPostsMsg.classList.remove('hidden');
		return;
	}
    noPostsMsg.classList.add('hidden');
    postArray.forEach(post => {
		const postCard = document.createElement('article');
		postCard.className = 'post-card';
		postCard.tabIndex = 0;
		
		const header = document.createElement('div');
		header.className = 'post-card-header';
		
		const title = document.createElement('h3');
		title.className = 'post-title';
		title.textContent = post.title;
		
		const meta = document.createElement('p');
		meta.className = 'post-meta';
		meta.textContent = `By ${post.author} on ${new Date(post.createdAt).toLocaleString()}`;
		
		header.appendChild(title);
		header.appendChild(meta);
		
		const contentDiv = document.createElement('div');
		contentDiv.className = 'post-content';
		contentDiv.innerHTML = marked.parse(post.content);
		
		// Ações para editar ou apagar
		const actionsDiv = document.createElement('div');
		actionsDiv.className = 'post-actions';
		
		if (currentUser.username === post.author) {
			const editBtn = document.createElement('button');
			editBtn.textContent = 'Editar';
			editBtn.onclick = () => startEditingPost(post.id);
			
			const deleteBtn = document.createElement('button');
			deleteBtn.textContent = 'Apagar';
			deleteBtn.onclick = () => deletePost(post.id);
			
			actionsDiv.appendChild(editBtn);
			actionsDiv.appendChild(deleteBtn);
		}
		
		postCard.appendChild(header);
		postCard.appendChild(contentDiv);
		postCard.appendChild(actionsDiv);
		
		postsList.appendChild(postCard);
	});
}

// Função para edição postagens
function startEditingPost(postId) {
    editingPostId = postId;
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    postTitleInput.value = post.title;
    postContentInput.value = post.content;
    createPostBtn.textContent = 'Salvar alterações';
    createPostBtn.focus();
}

// Função para apagar postagem por ID
function deletePost(postId) {
    if (!confirm('Tem certeza de que deseja excluir esta postagem?')) return;
    posts = posts.filter(post => post.id !== postId);
    savePosts(posts);
    applySearchAndRender();
}

// Função para criar ou atualizar postagem
function savePost() {
    const title = postTitleInput.value.trim();
    const content = postContentInput.value.trim();
	
    if (!title || !content) {
		alert('Título e conteúdo não podem estar vazios.');
		return;
	}
	
    if (editingPostId) {
		// Atualizar existente
		const idx = posts.findIndex(p => p.id === editingPostId);
		if (idx === -1) return;
		posts[idx].title = title;
		posts[idx].content = content;
		posts[idx].updatedAt = Date.now();
		editingPostId = null;
		createPostBtn.textContent = 'Postagem publicada';
		} else {
		// Criar novo
		const newPost = {
			id: Date.now().toString(),
			title,
			content,
			author: currentUser.username,
			createdAt: Date.now(),
			updatedAt: null
		};
		posts.unshift(newPost);
	}
    savePosts(posts);
    postTitleInput.value = '';
    postContentInput.value = '';
    applySearchAndRender();
}

// Atualizações da interface de autenticação
function updateAuthUI() {
    authSection.innerHTML = '';
    if (currentUser) {
		// show logged in user with logout button
		const userInfo = document.createElement('div');
		userInfo.id = 'user-info';
		userInfo.setAttribute('aria-label', 'User info and logout');
		userInfo.innerHTML = `
		<span>Seja bem-vindo(a), <strong>${escapeHtml(currentUser.username)}</strong></span>
		<button id="logout-btn" aria-label="Logout">Sair</button>
		`;
		authSection.appendChild(userInfo);
		document.getElementById('logout-btn').addEventListener('click', () => {
			logout();
		});
	}
}

function showAuthForm(showRegister=false) {
    isRegister = showRegister;
    authFormContainer.classList.remove('hidden');
    appSection.classList.add('hidden');
    authMessage.textContent = '';
    authFormTitle.textContent = showRegister ? 'Registro' : 'Acesso';
    authSubmitBtn.textContent = showRegister ? 'Registro' : 'Acesso';
    authSwitch.textContent = showRegister ? 'Já tem uma conta? Entrar' : "Não tem uma conta? Cadastre-se";
    authSwitch.setAttribute('aria-pressed', showRegister.toString());
    usernameInput.value = '';
    passwordInput.value = '';
    usernameInput.focus();
}

function showApp() {
    authFormContainer.classList.add('hidden');
    appSection.classList.remove('hidden');
    postTitleInput.value = '';
    postContentInput.value = '';
    previewArea.innerHTML = '';
    searchInput.value = '';
    filteredPosts = [...posts];
    renderPosts(filteredPosts);
}

// Aplica o filtro de pesquisa e depois renderiza
function applySearchAndRender() {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
		filteredPosts = [...posts];
		} else {
		filteredPosts = posts.filter(p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
	}
    renderPosts(filteredPosts);
    searchClearBtn.style.display = filteredPosts.length === posts.length ? 'none' : 'inline-block';
}

// Manipuladores de autenticação
async function registerUser(username, password) {
    username = username.trim();
    if (!isValidUsername(username)) {
		throw new Error('O nome de usuário deve ter de 3 a 20 caracteres e apenas letras, números ou sublinhados.');
	}
    if (!isValidPassword(password)) {
		throw new Error('A senha deve ter pelo menos 8 caracteres.');
	}
    const users = loadUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
		throw new Error('Nome de usuário já utilizado.');
	}
    const hashedPassword = await sha256(password);
    const newUser = {
		id: Date.now().toString(),
		username,
		password: hashedPassword,
		createdAt: Date.now()
	};
    users.push(newUser);
    saveUsers(users);
    return newUser;
}

async function loginUser(username, password) {
    username = username.trim();
    const users = loadUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
		throw new Error('Não é possível encontrar o usuário.');
	}
    const hashedPassword = await sha256(password);
    if (user.password !== hashedPassword) {
		throw new Error('Senha incorreta.');
	}
    return user;
}

// Função de Sair
function logout() {
    currentUser = null;
    clearSession();
    updateAuthUI();
    showAuthForm(false);
}

// Carregar/salvar usuários e postagens na inicialização do aplicativo
function loadAppData() {
    users = loadUsers();
    posts = loadPosts();
}

// Criação de postagens
function createPost(title, content) {
    title = title.trim();
    content = content.trim();
    if (!title) {
		throw new Error('O título da postagem é obrigatório.');
	}
    if (!content) {
		throw new Error('O conteúdo da postagem é obrigatório.');
	}
    const post = {
		id: Date.now().toString(),
		title,
		content,
		author: currentUser.username,
		createdAt: Date.now()
	};
    posts.unshift(post);
    savePosts(posts);
    filteredPosts = [...posts];
    renderPosts(filteredPosts);
}

// Função para pesquisar
function filterPosts(query) {
    query = query.trim().toLowerCase();
    if (!query) {
		filteredPosts = [...posts];
		renderPosts(filteredPosts);
		searchClearBtn.style.display = 'none';
		return;
	}
    filteredPosts = posts.filter(post => 
		post.title.toLowerCase().includes(query)
		|| post.content.toLowerCase().includes(query)
		|| post.author.toLowerCase().includes(query)
	);
    renderPosts(filteredPosts);
    searchClearBtn.style.display = filteredPosts.length > 0 ? 'inline-block' : 'none';
}

// Ouvintes de eventos
authForm.addEventListener('submit', async e => {
    e.preventDefault();
    authMessage.textContent = '';
    const username = usernameInput.value;
    const password = passwordInput.value;
    try {
		if (isRegister) {
			const newUser = await registerUser(username, password);
			currentUser = newUser;
			saveSession(currentUser);
			updateAuthUI();
			showApp();
			} else {
			const user = await loginUser(username, password);
			currentUser = user;
			saveSession(currentUser);
			updateAuthUI();
			showApp();
		}
		} catch(err) {
		authMessage.textContent = err.message;
	}
});

authSwitch.addEventListener('click', () => {
    showAuthForm(!isRegister);
});
authSwitch.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
		e.preventDefault();
		showAuthForm(!isRegister);
	}
});

// Visualização em tempo real do Markdown
postContentInput.addEventListener('input', () => {
    const raw = postContentInput.value;
    const rendered = marked.parse(raw, {sanitize: true});
    previewArea.innerHTML = rendered;
});

// Botão de criação de postagem
createPostBtn.addEventListener('click', () => {
    try {
		createPost(postTitleInput.value, postContentInput.value);
		postTitleInput.value = '';
		postContentInput.value = '';
		previewArea.innerHTML = '';
		alert('Postagem publicada com sucesso!');
		searchInput.value = '';
		filteredPosts = [...posts];
		renderPosts(filteredPosts);
		} catch (err) {
		alert(err.message);
	}
});

// Entrada da pesquisa
searchInput.addEventListener('input', e => {
    filterPosts(e.target.value);
});

// Limpar pesquisa
searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterPosts('');
    searchClearBtn.style.display = 'none';
    searchInput.focus();
});

// Melhoria de acessibilidade: limpar pesquisa no Escape
searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
		searchClearBtn.click();
	}
});

// Carga inicial e sessão
function loadApp() {
    posts = loadPosts();
    const sessionUser = loadSession();
    if (sessionUser) {
		currentUser = sessionUser;
		updateAuthUI();
		showApp();
		} else {
		showAuthForm(false);
		updateAuthUI();
	}
}

loadApp();

