export async function request(path, { method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'Semester' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(data.message || 'Не удалось выполнить действие.'), {
        status: response.status,
        errors: data.errors,
      });
    return data;
  } catch (error) {
    if (error.status) throw error;
    throw new Error(
      'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз — введённые данные остались в форме.',
    );
  } finally {
    clearTimeout(timer);
  }
}
