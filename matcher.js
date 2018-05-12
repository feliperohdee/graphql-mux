class Tracker {
    constructor(cursor) {
        this.cursor = cursor;
    }

    advancePosition() {
        this.cursor++;
    }

    moveCursor(unit) {
        this.cursor += unit;
    }
}

function trim(text, cursor) {
    return text.substring(cursor);
}

module.exports = (code, cursor) => {
    const BRACKET_PAIRS = {
        '(': ')',
        '{': '}',
        '[': ']'
    };

    let tracker = new Tracker(cursor);
    let trimmed = trim(code, cursor);
    let bracket = trimmed[0];
    let bracketStack = [];

    for (let i = 0; i < trimmed.length; i++) {
        let char = trimmed[i];

        if (char === BRACKET_PAIRS[bracket]) {
            bracketStack.pop();
        } else if (char === bracket) {
            bracketStack.push(char);
        }

        if (bracketStack.length === 0) {
            return tracker.cursor + 1;
        } else {
            tracker.advancePosition();
        }
    }

    return null;
};