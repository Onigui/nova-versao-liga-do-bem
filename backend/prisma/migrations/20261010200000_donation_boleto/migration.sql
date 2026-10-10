-- Doações via PagBank: boleto passa a ser forma de pagamento válida.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BOLETO';
