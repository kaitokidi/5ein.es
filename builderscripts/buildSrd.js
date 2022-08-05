const fs = require("fs")
const buildDataPath = fileName => `${process.cwd()}/data/${fileName}.json`

const data = {
	"phb": require(buildDataPath("book/book-phb")).data,
	"races": require(buildDataPath("races")).race,
	"legalinfo": require(buildDataPath("legalinfo")),
	"bestiary": require(buildDataPath("bestiary/bestiary-mm")),
	"backgrounds": require(buildDataPath("backgrounds")),
	"spells": require(buildDataPath("spells/spells-phb")),
	"classes": [
		require(buildDataPath("class/class-barbarian")),
		require(buildDataPath("class/class-bard")),
		require(buildDataPath("class/class-cleric")),
		require(buildDataPath("class/class-druid")),
		require(buildDataPath("class/class-fighter")),
		require(buildDataPath("class/class-monk")),
		require(buildDataPath("class/class-paladin")),
		require(buildDataPath("class/class-ranger")),
		require(buildDataPath("class/class-rogue")),
		require(buildDataPath("class/class-sorcerer")),
		require(buildDataPath("class/class-warlock")),
		require(buildDataPath("class/class-wizard")),
	],
}

const cleanEntriesRecursively = (entriesIn, idsToRemove) => {
	return entriesIn
		.filter(e => !idsToRemove.includes(e.id))
		.map(e => {
			if (typeof e !== "object" || !e.entries) { return e }
			return ({
				...e,
				entries: cleanEntriesRecursively(e.entries, idsToRemove),
			})
		})
}

const getSection = (source, idsTrail, idsToRemove = []) => {
	const [currentId, ...restOfIds] = idsTrail
	const section = source.find(({id}) => currentId === id)
	if (!section) {
		console.error("COULD NOT FIND SECTION", idsTrail[0])
		return {}
	}

	const cleanedEntries = cleanEntriesRecursively(section.entries, idsToRemove)

	if (restOfIds.length === 0) {
		return {
			...section,
			entries: cleanedEntries,
		}
	}
	if (!cleanedEntries) {
		console.error("got section", currentId, "but it has no 'entries'... was going to look for id", restOfIds[0])
	}

	return getSection(cleanedEntries, restOfIds, idsToRemove)
}
const srdOnly = dataInstance => dataInstance.srd
const sortByNameDesc = (a, b) => a.name.localeCompare(b.name)

let dataOut = [
	{
		name: "Legal Info",
		type: "section",
		entries: data.legalinfo[0],
	},
	getSection(data.phb, ["02b", "037", "038"]), // races explanation
	{
		name: "Races",
		type: "entries",
		entries: data.races
			.filter(srdOnly)
			.map(({subraces, ...rest}) => ({...rest, subraces: subraces ? subraces.filter(srdOnly) : null}))
			.sort(sortByNameDesc),
	},
	{
		name: "Classes",
		type: "entries",
		entries: data.classes
			.map(({class: classes, subclass, classFeature, subclassFeature, ...rest}) => ({
				...rest,
				class: classes ? classes.find(srdOnly) : null,
				subclass: subclass ? subclass.filter(srdOnly) : null,
				classFeature: classFeature ? classFeature.filter(srdOnly) : null,
				subclassFeature: subclassFeature ? subclassFeature.filter(srdOnly) : null,
			}))
			.sort((a, b) => sortByNameDesc(a.class, b.class)),

	},
	getSection(data.phb, ["00e", "029"], ["02a"]), // passat el nivell 1
	getSection(data.phb, ["0f2", "0f3"], ["101"]), // multiclasse
	getSection(data.phb, ["041", "042", "049"], ["04b"]), // alineament
	getSection(data.phb, ["041", "042", "04c"]), // idiomes
	getSection(data.phb, ["041", "053"]), // inspiració
	getSection(data.phb, ["041", "056"], ["05c"]), // referons
	{
		name: "Rerefons d'Exemple",
		type: "entries",
		entries: data.backgrounds.background.filter(srdOnly),
	},
	getSection(data.phb, ["05d"], ["05e", "0f1", "06f"]), // equipament
	getSection(data.phb, ["0f2", "102"], ["102s"]), // dots explicació
]

// 103 //emprar puntuacions de característica

const outPath = buildDataPath("srd")
fs.writeFileSync(outPath, JSON.stringify(dataOut, null, 2))