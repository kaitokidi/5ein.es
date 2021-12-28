"use strict";

class PageFilterEquipment extends PageFilter {
	constructor () {
		super();

		this._typeFilter = new Filter({
			header: "Type",
			deselFn: (it) => PageFilterItems._DEFAULT_HIDDEN_TYPES.has(it),
			displayFn: StrUtil.toTitleCase,
		});
		this._propertyFilter = new Filter({header: "Property", displayFn: StrUtil.uppercaseFirst});
		this._categoryFilter = new Filter({
			header: "Category",
			items: ["Basic", "Variant Genètica", "Specific Variant", "Altres"],
			deselFn: (it) => it === "Specific Variant",
			itemSortFn: null,
		});
		this._costFilter = new RangeFilter({header: "Cost", min: 0, max: 100, isAllowGreater: true, suffix: " gp"});
		this._weightFilter = new RangeFilter({header: "Weight", min: 0, max: 100, isAllowGreater: true, suffix: " lb."});
		this._focusFilter = new Filter({header: "Focus de Llançament de Conjurs", items: [...Parser.ITEM_SPELLCASTING_FOCUS_CLASSES]});
		this._damageTypeFilter = new Filter({header: "Weapon Damage Type", displayFn: it => Parser.dmgTypeToFull(it).uppercaseFirst(), itemSortFn: (a, b) => SortUtil.ascSortLower(Parser.dmgTypeToFull(a), Parser.dmgTypeToFull(b))});
		this._miscFilter = new Filter({header: "Miscellaneous", items: ["Item Group", "SRD", "Has Images", "Has Info"], isSrdFilter: true});
		this._poisonTypeFilter = new Filter({header: "Poison Type", items: ["ingerir", "ferida", "inhalar", "contacte"], displayFn: StrUtil.toTitleCase});
	}

	static mutateForFilters (item) {
		item._fProperties = item.property ? item.property.map(p => Renderer.item.propertyMap[p].name).filter(n => n) : [];

		item._fMisc = item.srd ? ["SRD"] : [];
		if (item._isItemGroup) item._fMisc.push("Item Group");
		if (item.hasFluff) item._fMisc.push("Has Info");
		if (item.hasFluffImages) item._fMisc.push("Has Images");

		if (item.focus || item.type === "INS" || item.type === "SCF") {
			item._fFocus = item.focus ? item.focus === true ? [...Parser.ITEM_SPELLCASTING_FOCUS_CLASSES] : [...item.focus] : [];
			if (item.type === "INS" && !item._fFocus.includes("Bard")) item._fFocus.push("Bard");
			if (item.type === "SCF") {
				switch (item.scfType) {
					case "arcane": {
						if (!item._fFocus.includes("Sortiller")) item._fFocus.push("Sortiller");
						if (!item._fFocus.includes("Bruixot")) item._fFocus.push("Bruixot");
						if (!item._fFocus.includes("Mag")) item._fFocus.push("Mag");
						break;
					}
					case "druida": {
						if (!item._fFocus.includes("Druida")) item._fFocus.push("Druida");
						break;
					}
					case "holy":
						if (!item._fFocus.includes("Clergue")) item._fFocus.push("Clergue");
						if (!item._fFocus.includes("Paladí")) item._fFocus.push("Paladí");
						break;
				}
			}
		}

		item._fValue = (item.value || 0) / 100;
	}

	addToFilters (item, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(item.source);
		this._typeFilter.addItem(item._typeListText);
		this._propertyFilter.addItem(item._fProperties);
		this._damageTypeFilter.addItem(item.dmgType);
		this._poisonTypeFilter.addItem(item.poisonTypes);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._typeFilter,
			this._propertyFilter,
			this._categoryFilter,
			this._costFilter,
			this._weightFilter,
			this._focusFilter,
			this._damageTypeFilter,
			this._miscFilter,
			this._poisonTypeFilter,
		];
	}

	toDisplay (values, it) {
		return this._filterBox.toDisplay(
			values,
			it.source,
			it._typeListText,
			it._fProperties,
			it._category,
			it._fValue,
			it.weight,
			it._fFocus,
			it.dmgType,
			it._fMisc,
			it.poisonTypes,
		);
	}
}

class PageFilterItems extends PageFilterEquipment {
	// region static
	static _rarityValue (rarity) {
		switch (rarity) {
			case "none": return 0;
			case "common": return 1;
			case "uncommon": return 2;
			case "rare": return 3;
			case "very rare": return 4;
			case "legendary": return 5;
			case "artifact": return 6;
			case "varia": return 7;
			case "unknown (magic)": return 8;
			case "unknown": return 9;
			default: return 10;
		}
	}

	static sortItems (a, b, o) {
		if (o.sortBy === "name") return SortUtil.compareListNames(a, b);
		else if (o.sortBy === "type") return SortUtil.ascSortLower(a.values.type, b.values.type) || SortUtil.compareListNames(a, b);
		else if (o.sortBy === "source") return SortUtil.ascSortLower(a.values.source, b.values.source) || SortUtil.compareListNames(a, b);
		else if (o.sortBy === "rarity") return SortUtil.ascSort(PageFilterItems._rarityValue(a.values.rarity), PageFilterItems._rarityValue(b.values.rarity)) || SortUtil.compareListNames(a, b);
		else if (o.sortBy === "attunement") return SortUtil.ascSort(a.values.attunement, b.values.attunement) || SortUtil.compareListNames(a, b);
		else if (o.sortBy === "count") return SortUtil.ascSort(a.values.count, b.values.count) || SortUtil.compareListNames(a, b);
		else if (o.sortBy === "weight") return SortUtil.ascSort(a.values.weight, b.values.weight) || SortUtil.compareListNames(a, b);
		else if (o.sortBy === "cost") return SortUtil.ascSort(a.values.cost, b.values.cost) || SortUtil.compareListNames(a, b);
		else return 0;
	}

	static _getBaseItemDisplay (baseItem) {
		if (!baseItem) return null;
		let [name, source] = baseItem.split("|");
		name = name.toTitleCase();
		source = source || SRC_DMG;
		if (source.toLowerCase() === SRC_PHB.toLowerCase()) return name;
		return `${name} (${Parser.sourceJsonToAbv(source)})`;
	}

	static _sortAttunementFilter (a, b) {
		const ixA = PageFilterItems._FILTER_BASE_ITEMS_ATTUNEMENT.indexOf(a.item);
		const ixB = PageFilterItems._FILTER_BASE_ITEMS_ATTUNEMENT.indexOf(b.item);

		if (~ixA && ~ixB) return ixA - ixB;
		if (~ixA) return -1;
		if (~ixB) return 1;
		return SortUtil.ascSortLower(a, b);
	}

	static _getAttunementFilterItems (item) {
		const out = item._attunementCategory ? [item._attunementCategory] : [];

		if (!item.reqAttuneTags && !item.reqAttuneAltTags) return out;

		[...item.reqAttuneTags || [], ...item.reqAttuneAltTags || []].forEach(tagSet => {
			Object.entries(tagSet)
				.forEach(([prop, val]) => {
					switch (prop) {
						case "background": out.push(`Background: ${val.split("|")[0].toTitleCase()}`); break;
						case "languageProficiency": out.push(`Language Proficiency: ${val.toTitleCase()}`); break;
						case "skillProficiency": out.push(`Skill Proficiency: ${val.toTitleCase()}`); break;
						case "race": out.push(`Race: ${val.split("|")[0].toTitleCase()}`); break;
						case "creatureType": out.push(`Creature Type: ${val.toTitleCase()}`); break;
						case "size": out.push(`Size: ${Parser.sizeAbvToFull(val)}`.toTitleCase()); break;
						case "class": out.push(`Class: ${val.split("|")[0].toTitleCase()}`); break;
						case "alineament": out.push(`Alignment: ${Parser.alignmentListToFull(val).toTitleCase()}`); break;

						case "str":
						case "dex":
						case "con":
						case "int":
						case "wis":
						case "cha": out.push(`${Parser.attAbvToFull(prop)}: ${val} or Higher`); break;

						case "spellcasting": out.push("Conjurador"); break;
						case "psionics": out.push("Psionics"); break;
					}
				});
		});

		return out;
	}

	// endregion
	constructor () {
		super();

		this._tierFilter = new Filter({header: "Tier", items: ["none", "minor", "major"], itemSortFn: null, displayFn: StrUtil.toTitleCase});
		this._attachedSpellsFilter = new Filter({header: "Attached Spells", displayFn: (it) => it.split("|")[0].toTitleCase(), itemSortFn: SortUtil.ascSortLower});
		this._lootTableFilter = new Filter({
			header: "Found On",
			items: ["Taula d'Objectes Màgics A", "Taula d'Objectes Màgics B", "Taula d'Objectes Màgics C", "Taula d'Objectes Màgics D", "Taula d'Objectes Màgics E", "Taula d'Objectes Màgics F", "Taula d'Objectes Màgics G", "Taula d'Objectes Màgics H", "Taula d'Objectes Màgics I"],
			displayFn: it => {
				const [name, sourceJson] = it.split("|");
				return `${name}${sourceJson ? ` (${Parser.sourceJsonToAbv(sourceJson)})` : ""}`
			},
		});
		this._rarityFilter = new Filter({
			header: "Rarity",
			items: [...Parser.ITEM_RARITIES],
			itemSortFn: null,
			displayFn: StrUtil.toTitleCase,
		});
		this._attunementFilter = new Filter({header: "Attunement", items: [...PageFilterItems._FILTER_BASE_ITEMS_ATTUNEMENT], itemSortFn: PageFilterItems._sortAttunementFilter});
		this._bonusFilter = new Filter({header: "Bonus", items: ["Classe d'Armadura", "Proficiency Bonus", "Spell Attacks", "Spell Save DC", "Saving Throws", "Weapon Attack and Damage Rolls", "Weapon Attack Rolls", "Weapon Damage Rolls"]});
		this._rechargeTypeFilter = new Filter({header: "Recharge Type", displayFn: Parser.itemRechargeToFull})
		this._miscFilter = new Filter({header: "Miscellaneous", items: ["Ability Score Adjustment", "Charges", "Cursed", "Grants Proficiency", "Has Images", "Has Info", "Item Group", "Magic", "Mundane", "Sentient", "SRD"], isSrdFilter: true});
		this._baseSourceFilter = new SourceFilter({header: "Base Source", selFn: null});
		this._baseItemFilter = new Filter({header: "Base Item", displayFn: this.constructor._getBaseItemDisplay.bind(this.constructor)});
	}

	static mutateForFilters (item) {
		super.mutateForFilters(item);

		item._fTier = [item.tier ? item.tier : "none"];

		if (item.curse) item._fMisc.push("Cursed");
		const isMundane = Renderer.item.isMundane(item);
		item._fMisc.push(isMundane ? "Mundane" : "Magic");
		item._fIsMundane = isMundane;
		if (item.ability) item._fMisc.push("Ability Score Adjustment");
		if (item.charges) item._fMisc.push("Charges");
		if (item.sentient) item._fMisc.push("Sentient");
		if (item.grantsProficiency) item._fMisc.push("Grants Proficiency");

		item._fBaseItemSelf = item._isBaseItem ? `${item.name}|${item.source}`.toLowerCase() : null;
		item._fBaseItem = [
			item.baseItem ? (item.baseItem.includes("|") ? item.baseItem : `${item.baseItem}|${SRC_DMG}`).toLowerCase() : null,
			item._baseName ? `${item._baseName}|${item._baseSource || item.source}`.toLowerCase() : null,
		].filter(Boolean);
		item._fBaseItemAll = item._fBaseItemSelf ? [item._fBaseItemSelf, ...item._fBaseItem] : item._fBaseItem;

		item._fBonus = [];
		if (item.bonusAc) item._fBonus.push("Classe d'Armadura");
		if (item.bonusWeapon) item._fBonus.push("Weapon Attack and Damage Rolls");
		if (item.bonusWeaponAttack) item._fBonus.push("Weapon Attack Rolls");
		if (item.bonusWeaponDamage) item._fBonus.push("Weapon Damage Rolls");
		if (item.bonusSpellAttack) item._fBonus.push("Spell Attacks");
		if (item.bonusSpellSaveDc) item._fBonus.push("Spell Save DC");
		if (item.bonusSavingThrow) item._fBonus.push("Saving Throws");
		if (item.bonusProficiencyBonus) item._fBonus.push("Proficiency Bonus");

		item._fAttunement = this._getAttunementFilterItems(item);
	}

	addToFilters (item, isExcluded) {
		if (isExcluded) return;

		super.addToFilters(item, isExcluded);

		this._sourceFilter.addItem(item.source);
		this._tierFilter.addItem(item._fTier)
		this._attachedSpellsFilter.addItem(item.attachedSpells);
		this._lootTableFilter.addItem(item.lootTables);
		this._baseItemFilter.addItem(item._fBaseItem);
		this._baseSourceFilter.addItem(item._baseSource);
		this._attunementFilter.addItem(item._fAttunement);
		this._rechargeTypeFilter.addItem(item.recharge);
	}

	async _pPopulateBoxOptions (opts) {
		await super._pPopulateBoxOptions(opts);

		opts.filters = [
			this._sourceFilter,
			this._typeFilter,
			this._tierFilter,
			this._rarityFilter,
			this._propertyFilter,
			this._attunementFilter,
			this._categoryFilter,
			this._costFilter,
			this._weightFilter,
			this._focusFilter,
			this._damageTypeFilter,
			this._bonusFilter,
			this._miscFilter,
			this._rechargeTypeFilter,
			this._poisonTypeFilter,
			this._lootTableFilter,
			this._baseItemFilter,
			this._baseSourceFilter,
			this._attachedSpellsFilter,
		];
	}

	toDisplay (values, it) {
		return this._filterBox.toDisplay(
			values,
			it.source,
			it._typeListText,
			it._fTier,
			it.rarity,
			it._fProperties,
			it._fAttunement,
			it._category,
			it._fValue,
			it.weight,
			it._fFocus,
			it.dmgType,
			it._fBonus,
			it._fMisc,
			it.recharge,
			it.poisonTypes,
			it.lootTables,
			it._fBaseItemAll,
			it._baseSource,
			it.attachedSpells,
		);
	}
}
PageFilterItems._DEFAULT_HIDDEN_TYPES = new Set(["tresor", "futuristic", "modern", "renaissance"]);
PageFilterItems._FILTER_BASE_ITEMS_ATTUNEMENT = ["Cal Harmonitzar", "Cal Harmonitzar By...", "Attunement Optional", VeCt.STR_NO_ATTUNEMENT];

class ModalFilterItems extends ModalFilter {
	/**
	 * @param opts
	 * @param opts.namespace
	 * @param [opts.isRadio]
	 * @param [opts.allData]
	 */
	constructor (opts) {
		opts = opts || {};
		super({
			...opts,
			modalTitle: `Item${opts.isRadio ? "" : "s"}`,
			pageFilter: new PageFilterItems(),
		})
	}

	_$getColumnHeaders () {
		const btnMeta = [
			{sort: "name", text: "Name", width: "4"},
			{sort: "type", text: "Type", width: "6"},
			{sort: "source", text: "Source", width: "1"},
		];
		return ModalFilter._$getFilterColumnHeaders(btnMeta);
	}

	async _pInit () {
		await Renderer.item.populatePropertyAndTypeReference();
	}

	async _pLoadAllData () {
		const brew = await BrewUtil.pAddBrewData();
		const fromData = await Renderer.item.pBuildList({isAddGroups: true, isBlacklistVariants: true});
		const fromBrew = await Renderer.item.pGetItemsFromHomebrew(brew);
		return [...fromData, ...fromBrew];
	}

	_getListItem (pageFilter, item, itI) {
		if (item.noDisplay) return null;

		Renderer.item.enhanceItem(item);
		pageFilter.mutateAndAddToFilters(item);

		const eleRow = document.createElement("div");
		eleRow.className = "px-0 w-100 flex-col no-shrink";

		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS](item);
		const source = Parser.sourceJsonToAbv(item.source);
		const type = item._typeListText.join(", ");

		eleRow.innerHTML = `<div class="w-100 flex-vh-center lst--border no-select lst__wrp-cells">
			<div class="col-0-5 pl-0 flex-vh-center">${this._isRadio ? `<input type="radio" name="radio" class="no-events">` : `<input type="checkbox" class="no-events">`}</div>

			<div class="col-0-5 px-1 flex-vh-center">
				<div class="ui-list__btn-inline px-2" title="Toggle Preview">[+]</div>
			</div>

			<div class="col-5 ${this._getNameStyle()}">${item.name}</div>
			<div class="col-5">${type.uppercaseFirst()}</div>
			<div class="col-1 text-center ${Parser.sourceJsonToColor(item.source)} pr-0" title="${Parser.sourceJsonToFull(item.source)}" ${BrewUtil.sourceJsonToStyle(item.source)}>${source}</div>
		</div>`;

		const btnShowHidePreview = eleRow.firstElementChild.children[1].firstElementChild;

		const listItem = new ListItem(
			itI,
			eleRow,
			item.name,
			{
				hash,
				source,
				sourceJson: item.source,
				type,
			},
			{
				cbSel: eleRow.firstElementChild.firstElementChild.firstElementChild,
				btnShowHidePreview,
			},
		);

		ListUiUtil.bindPreviewButton(UrlUtil.PG_ITEMS, this._allData, listItem, btnShowHidePreview);

		return listItem;
	}
}
