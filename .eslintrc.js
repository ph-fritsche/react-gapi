module.exports = {
    extends: [
        '@ph-fritsche/eslint-config-react',
    ],
    overrides: [
        {
            files: ['**.{ts,tsx}'],
            parser: '@typescript-eslint/parser',
            plugins: [
                '@typescript-eslint',
            ],
            extends: [
                '@ph-fritsche/eslint-config-react',
                'plugin:@typescript-eslint/recommended',
            ],
        },
    ],
}
