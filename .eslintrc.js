module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true,
        "mocha": true
    },
    "globals": {
        "sinon": true,
        "should": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:react/recommended"
    ],
    "parserOptions": {
        "ecmaVersion": 2018,
        "sourceType": "module"
    },
    "plugins": [
        "react"
    ],
    "settings": {
        "react": {
            "version": "16.0", // React version, default to the latest React stable release
        }
    },
    "rules": {
        "quotes": [
            "warn",
            "single"
        ],
        "semi": [
            "warn",
            "always"
        ],
        "curly": [
            "warn",
            "multi-line"
        ],
        "padded-blocks": [
            "warn",
            "never"
        ],
        "no-var": "error",
        "brace-style": [
            "warn",
            "1tbs"
        ],
        "no-console": 0,
        "no-unused-vars": ["error", {"vars": "all", "args": "after-used", "ignoreRestSiblings": true}],
        "react/display-name": 0,
        "react/prop-types": 0
    }
};
