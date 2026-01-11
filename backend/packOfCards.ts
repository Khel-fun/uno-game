// Basic UNO-like card pack definition used for state mapping
const colors = ['R', 'G', 'B', 'Y']; // Red, Green, Blue, Yellow
const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const specials = ['skip', '_', 'D2']; // Skip, Reverse, Draw 2
const wilds = ['W', 'D4W']; // Wild, Wild Draw 4

function buildDeck() {
  const deck = [];
  colors.forEach((color) => {
    numbers.forEach((num) => {
      // One 0 per color, two of 1-9
      deck.push(`${num}${color}`);
      if (num !== '0') deck.push(`${num}${color}`);
    });
    specials.forEach((sp) => {
      deck.push(`${sp}${color}`);
      deck.push(`${sp}${color}`);
    });
  });
  wilds.forEach((w) => {
    deck.push(w);
    deck.push(w);
    deck.push(w);
    deck.push(w);
  });
  return deck;
}

module.exports = { buildDeck };
