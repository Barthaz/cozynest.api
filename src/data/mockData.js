const collections = [
  { id: 1, slug: "living-room", name: "Salon", description: "Produkty do salonu" },
  { id: 2, slug: "bedroom", name: "Sypialnia", description: "Produkty do sypialni" },
];

const products = [
  {
    id: 1,
    slug: "linen-sofa",
    name: "Sofa lniana",
    price: 2999,
    currency: "PLN",
    collectionSlug: "living-room",
  },
  {
    id: 2,
    slug: "oak-bed",
    name: "Lozko debowe",
    price: 3599,
    currency: "PLN",
    collectionSlug: "bedroom",
  },
];

module.exports = {
  collections,
  products,
};
