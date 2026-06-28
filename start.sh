#!/bin/sh
set -e

echo "Aguardando banco de dados ficar acessivel..."
MAX=10
i=1
until npx prisma migrate deploy; do
  if [ $i -ge $MAX ]; then
    echo "Banco inacessivel apos $MAX tentativas. Abortando."
    exit 1
  fi
  echo "Tentativa $i falhou. Aguardando 5s..."
  i=$((i + 1))
  sleep 5
done

exec node dist/main.js
