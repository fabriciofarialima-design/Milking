# Milking Distribuidora — Solicitação de Orçamento

Site para clientes (revendas) montarem uma lista de produtos e enviarem solicitação de orçamento.
O time comercial recebe o pedido via WhatsApp e entra em contato com os valores.

## Como testar localmente

Abra o arquivo `index.html` no navegador (duplo-clique no arquivo). Funciona sem servidor.

## Como editar produtos

Abra o `index.html` num editor de texto e encontre o array `PRODUCTS` (por volta da linha 180). Cada produto tem esta estrutura:

```javascript
{
  code: 25,                    // Código do produto no ERP
  name: "TETEIRA MILKING...",  // Nome completo
  brand: "Milking",            // Marca
  category: "TETEIRAS...",     // Categoria (vira filtro automático)
  package: "JG/4",             // Embalagem
  reference: "1004",           // Referência
  barcode: "SEM GTIN",         // Código de barras
  aliases: ["liner", "..."]    // Apelidos regionais (aparecem na busca)
}
```

Para adicionar um produto: copie um bloco existente, cole logo abaixo e altere os dados.
Para remover: apague o bloco inteiro (do `{` ao `}`).

## Como configurar o Webhook (N8N)

### 1. No index.html

Encontre esta linha no topo do JavaScript:

```javascript
const WEBHOOK_URL = "";
```

Cole a URL do webhook do N8N entre as aspas:

```javascript
const WEBHOOK_URL = "https://seu-n8n.app.n8n.cloud/webhook/milking-orcamento";
```

### 2. No N8N — Passo a passo

1. Crie um novo Workflow no N8N
2. Adicione o node **Webhook**:
   - HTTP Method: `POST`
   - Path: `milking-orcamento`
   - Clique em "Listen for Test Event" e envie um pedido de teste pelo site
3. Adicione um node **Code** (JavaScript) para formatar a mensagem:

```javascript
const data = $input.first().json;
const items = data.items.map(i => `  • ${i.qty}x ${i.name} (Cód. ${i.code}) — ${i.package}`).join('\n');

const message = `🧾 *Novo Pedido de Orçamento*

👤 ${data.customer.name}
📱 ${data.customer.whatsapp}
🏪 ${data.customer.store}

📦 *Itens (${data.itemCount}):*
${items}

${data.notes ? '📝 ' + data.notes : ''}`;

return [{ json: { message, phone: data.customer.whatsapp } }];
```

4. Para enviar via WhatsApp, adicione um dos seguintes nodes:
   - **WhatsApp Business** (se tiver API oficial)
   - **HTTP Request** apontando para a API do seu provedor de WhatsApp
   - **Evolution API** ou outro gateway WhatsApp

5. Ative o Workflow

### Payload enviado pelo site

```json
{
  "timestamp": "2026-03-25T14:30:00.000Z",
  "customer": {
    "name": "João Silva",
    "whatsapp": "5511999999999",
    "store": "Agropecuária do João"
  },
  "items": [
    {
      "code": 25,
      "name": "TETEIRA MILKING 2 ANEIS 9.5 mm SLX C/4",
      "qty": 3,
      "package": "JG/4",
      "reference": "1004"
    }
  ],
  "notes": "Entrega urgente",
  "itemCount": 3,
  "source": "website"
}
```

## Deploy no GitHub Pages

1. Faça push do código para o GitHub
2. No GitHub, vá em **Settings > Pages**
3. Em Source, selecione **Deploy from branch** > `main` > `/ (root)`
4. O site estará disponível em `https://seu-usuario.github.io/Milking/`
