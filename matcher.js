module.exports = (text, cursor, pair = '}') => {
    let bracketIndex = 0;
    const trimmed = text.slice(cursor);
    const bracket = trimmed[0];

    for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];

        if (char === pair) {
            bracketIndex--;
        } else if (char === bracket) {
            bracketIndex++;
        }

        if (bracketIndex !== 0) {
            cursor++;
        } else {
            return cursor + 1;
        }
    }

    return null;
};