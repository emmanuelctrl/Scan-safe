async function login(email, password) {
  setLoading(true);
  try {
    // Clear any previous account's tokens before logging in.
    tokenStore.clear();
    tokenStore.clearOwner();
    const { token, user: u } = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    tokenStore.set(token);
    setUser(u);
    return u;
  } finally {
    setLoading(false);
  }
}

async function register(payload) {
  setLoading(true);
  try {
    // Clear any previous account's tokens before registering.
    tokenStore.clear();
    tokenStore.clearOwner();
    const { token, user: u } = await api('/api/auth/register', {
      method: 'POST',
      body: payload,
    });
    tokenStore.set(token);
    setUser(u);
    return u;
  } finally {
    setLoading(false);
  }
}