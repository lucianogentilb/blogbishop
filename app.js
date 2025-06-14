/* Funções utilitárias */
// Uma sequência de caracteres simples que não diferencia maiúsculas de minúsculas contém
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

/* Chaves de armazenamento */
const USERS_KEY = 'blogsphere-users';
const POSTS_KEY = 'blogsphere-posts';
const SESSION_KEY = 'blogsphere-session-user';

/* Estado */
let currentUser = null;
let posts = [];
let filteredPosts = [];
let isRegister = false;

/* Elementos DOM */
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

/* Inicialização */
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

/* Renderizar postagens */

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
  postCard.setAttribute('tabindex', '0');

  const header = document.createElement('header');
  header.className = 'post-card-header';

  const title = document.createElement('h3');
  title.className = 'post-title';
  title.textContent = post.title;

  const meta = document.createElement('p');
  meta.className = 'post-meta';
  meta.textContent = `By ${post.author} on ${formatDate(post.createdAt)}`;

  header.appendChild(title);
  header.appendChild(meta);
  postCard.appendChild(header);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'post-content';
  // Use marked.js para converter markdown em html com a opção sanitize habilitada
  contentDiv.innerHTML = marked.parse(post.content, {sanitize: true});
  postCard.appendChild(contentDiv);

  postsList.appendChild(postCard);
});
}

/* Atualizações da interface de autenticação */

function updateAuthUI() {
authSection.innerHTML = '';
if (currentUser) {
  // mostrar usuário conectado com botão de logout
  const userInfo = document.createElement('div');
  userInfo.id = 'user-info';
  userInfo.setAttribute('aria-label', 'User info and logout');
  userInfo.innerHTML = `
  <span>Bem-vindo(a), <strong>${escapeHtml(currentUser.username)}</strong></span>
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

/* Manipuladores de autenticação */

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

function logout() {
currentUser = null;
clearSession();
updateAuthUI();
showAuthForm(false);
}

/* Pós-criação */

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

/* Procurar */

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

/* Ouvintes de eventos */

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

// Visualização ao vivo do Markdown
postContentInput.addEventListener('input', () => {
const raw = postContentInput.value;
const rendered = marked.parse(raw, {sanitize: true});
previewArea.innerHTML = rendered;
});

// Botão Criar postagem
createPostBtn.addEventListener('click', () => {
try {
  createPost(postTitleInput.value, postContentInput.value);
  postTitleInput.value = '';
  postContentInput.value = '';
  previewArea.innerHTML = '';
  alert('Post publicado com sucesso!');
  searchInput.value = '';
  filteredPosts = [...posts];
  renderPosts(filteredPosts);
} catch (err) {
  alert(err.message);
}
});

// Search input
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

/* Carregamento inicial e sessão */
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