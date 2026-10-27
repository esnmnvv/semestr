import pg from 'pg';

export function makePool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString)
    throw new Error('DATABASE_URL is required. Run npm run db:local or configure .env.');
  return new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
}

// SET LOCAL cannot leak a previous student's identity into a pooled connection.
export async function withUser(pool, userId, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function readProfile(pool, id) {
  return withUser(pool, id, async (client) => {
    const { rows } = await client.query(
      'SELECT p.id, p.name, p.timezone, p.created_at, u.email FROM profiles p JOIN users u ON u.id = p.id WHERE p.id = $1',
      [id],
    );
    return rows[0];
  });
}
