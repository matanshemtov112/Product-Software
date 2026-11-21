#!/bin/sh
# מופעל בתוך הקונטיינר של docker compose: מתקין, יוצר טבלאות, ממלא דמו בפעם הראשונה ומריץ את האתר
set -e
npm ci
npx prisma migrate deploy
if [ "$(node -e "new (require('@prisma/client').PrismaClient)().user.count().then(n => console.log(n))")" = "0" ]; then
  npx prisma db seed
fi
exec npx next dev -H 0.0.0.0 -p 3000
