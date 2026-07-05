# Capitale — Gestión de finanzas personales

App personal para llevar el control de tus finanzas: cuentas (bancos, billeteras, brokers), ingresos, gastos, inversiones (acciones argentinas, CEDEARs, bonos, cripto, plazos fijos), cotizaciones en vivo y dashboard con rendimientos.

**Stack**: Next.js 16 (App Router) · MongoDB + Mongoose · TanStack React Query · react-hook-form + zod · shadcn/ui (base-nova) · Recharts.

## Setup

1. **Base de datos**: creá un cluster gratuito en [MongoDB Atlas](https://cloud.mongodb.com) y copiá la URI de conexión.

2. **Variables de entorno**: en `.env.local` completá:

   ```
   MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/capitale
   AUTH_SECRET=<un secreto largo y aleatorio, ej: openssl rand -base64 32>
   ```

3. **Correr la app**:

   ```bash
   npm install
   npm run dev
   ```

4. Abrí [http://localhost:3000](http://localhost:3000) → te redirige a `/registro` para crear tu usuario (la app es de un solo usuario: después del primer registro se bloquea).

### Probar sin Atlas

Para desarrollo sin internet podés levantar un MongoDB en memoria:

```bash
node scripts/dev-mongo.mjs
# en otra terminal:
MONGODB_URI=mongodb://127.0.0.1:37017/capitale npm run dev
```

(Los datos se pierden al cerrar el proceso.)

## Cotizaciones

Se traen de APIs públicas gratuitas con cache de 5 minutos:

- **Dólar** (oficial/blue/MEP/CCL): [DolarAPI](https://dolarapi.com)
- **Acciones / CEDEARs / bonos BYMA**: [data912](https://data912.com) — usá el símbolo tal como cotiza (GGAL, AAPL, AL30)
- **Cripto**: [CoinGecko](https://www.coingecko.com) — al cargar una compra de cripto indicá el *id de CoinGecko* (`bitcoin`, `ethereum`, `tether`, …)

La conversión ARS ↔ USD de toda la app usa el **dólar MEP**.

## Notas de uso

- El **saldo de cada cuenta** se ajusta automáticamente al cargar ingresos, gastos y operaciones de inversión (y se revierte al editarlos o borrarlos). También podés ajustarlo a mano editando la cuenta.
- Los **bonos** se cargan en nominales, con precio por 100 nominales (como cotizan en el mercado).
- Los **plazos fijos** no descuentan de ninguna cuenta al crearse; al "cobrar" se acredita capital + interés en la cuenta que elijas.
- La **cartera** se deriva del historial de operaciones (precio promedio ponderado); el dashboard guarda un snapshot diario del patrimonio para el gráfico de evolución.
