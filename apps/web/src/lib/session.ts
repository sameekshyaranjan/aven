const TOKEN_KEY = 'aven-demo-token';

export const readToken = () => sessionStorage.getItem(TOKEN_KEY);
export const saveToken = (token: string) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);
