import { item, ValueField } from '@1password/op-js';

export const getOnePasswordValue = async (
  vault: string,
  secretName: string,
  secretKey: string,
) => {
  console.log(
    `🌐 Getting secret value from 1Password for ${secretName} with key ${secretKey}`,
  );

  // Make sure OP_CONNECT_TOKEN and OP_CONNECT_HOST are set
  if (!process.env.OP_CONNECT_TOKEN || !process.env.OP_CONNECT_HOST) {
    throw new Error('OP_CONNECT_TOKEN and OP_CONNECT_HOST are not set');
  }

  console.log('OP_CONNECT_TOKEN.length', process.env.OP_CONNECT_TOKEN.length);

  const secret = (await item.get(secretName, {
    vault,
    fields: { label: [secretKey] },
  })) as ValueField;

  return secret.value;
};
