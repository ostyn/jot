module.exports = {
	globDirectory: 'dist/',
	globPatterns: [
		'**/*.{js,css,json,html,svg}'
	],
	ignoreURLParametersMatching: [
		/^utm_/,
		/^fbclid$/
	],
	swDest: 'dist/sw.js'
};