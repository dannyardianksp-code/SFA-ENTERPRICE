-- Hapus fitur mati "Customer Product mapping": write-only, tidak pernah dibaca
-- di mana pun (termasuk Order, yang harusnya jadi pemakai paling wajar).
DROP TABLE IF EXISTS customer_products;
