const appRoot = require("app-root-path");
// var config = require(appRoot + "/config/config.js");
const { rarity_analyze } = require(appRoot + "/cmd/rarity_analyze");
const { rarity_analyze_normalized } = require(appRoot +
  "/cmd/rarity_analyze_normalized");
const request = require("sync-request");
const express = require("express");
const router = express.Router();
const Web3 = require("web3");
const fs = require("fs");
const Database = require("better-sqlite3");
const _ = require("lodash");
const formidable = require("formidable");
const { captureRejectionSymbol } = require("events");

/* GET home page. */
router.get("/:collectionName", function (req, res, next) {
  let config, databasePath, db;

  const { collectionName } = req.params;

  if (!collectionName) {
    return res.status(400).json({
      success: false,
      message: "Invalid Collection",
    });
  }

  try {
    config = require(appRoot + `/config/${collectionName}_config.js`);

    config.sqlite_file_name = `${collectionName}.sqlite`;
    databasePath = appRoot + "/config/" + config.sqlite_file_name;

    db = new Database(databasePath);
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      success: false,
      message: "Invalid Collection",
    });
  }

  let collectionDetails;
  try {
    collectionDetails = db
      .prepare(`SELECT * FROM ${collectionName}_details`)
      .all();
  } catch (err) {}

  let search = req.query.search;
  let traits = decodeURIComponent(req.query.traits);
  let useTraitNormalization = req.query.trait_normalization;
  let orderBy = req.query.order_by;
  let page = req.query.page;

  let offset = 0;
  let limit = config.page_item_num;

  if (_.isEmpty(search)) {
    search = "";
  }

  if (_.isEmpty(traits)) {
    traits = "";
  }

  let scoreTable = `${collectionName}_scores`;
  if (useTraitNormalization == "1") {
    useTraitNormalization = "1";
    scoreTable = `normalized_${collectionName}_scores`;
  } else {
    useTraitNormalization = "0";
  }

  if (orderBy == "rarity" || orderBy == "id") {
    orderBy = orderBy;
  } else {
    orderBy = "rarity";
  }

  if (!_.isEmpty(page)) {
    page = parseInt(page);
    if (!isNaN(page)) {
      offset = (Math.abs(page) - 1) * limit;
    } else {
      page = 1;
    }
  } else {
    page = 1;
  }

  let selectedTraits = traits != "" ? traits.split(",") : [];
  let totalCollectionItemCount = 0;
  let collectionItems = null;
  let orderByStmt = "";
  if (orderBy == "rarity") {
    orderByStmt = "ORDER BY " + scoreTable + ".rarity_rank ASC";
  } else {
    orderByStmt = `ORDER BY ${collectionName}s.id ASC`;
  }

  let totalSupply = db
    .prepare(
      `SELECT COUNT(${collectionName}s.id) as ${collectionName}_total FROM ${collectionName}s`
    )
    .get();
  console.log(totalSupply, "totalSupply");
  totalSupply = [...Object.values(totalSupply)][0];

  let allTraitTypes = db.prepare("SELECT trait_types.* FROM trait_types").all();
  let allTraitTypesData = {};
  let i = 2;
  allTraitTypes.forEach((traitType) => {
    if (i == 2) {
      console.log();
      i += 1;
    }
    allTraitTypesData[traitType.trait_type] = [...Object.values(traitType)][3];
  });

  let allTraits = db
    .prepare(
      `SELECT trait_types.trait_type, trait_detail_types.trait_detail_type, trait_detail_types.${collectionName}_count, trait_detail_types.trait_type_id, trait_detail_types.id trait_detail_type_id  FROM trait_detail_types INNER JOIN trait_types ON (trait_detail_types.trait_type_id = trait_types.id) WHERE trait_detail_types.${collectionName}_count != 0 ORDER BY trait_types.trait_type, trait_detail_types.trait_detail_type`
    )
    .all();
  let totalCollectionItemCountQuery =
    `SELECT COUNT(${collectionName}s.id) as ${collectionName}_total FROM ${collectionName}s INNER JOIN ` +
    scoreTable +
    ` ON (${collectionName}s.id = ` +
    scoreTable +
    `.${collectionName}_id) `;
  let collectionItemsQuery =
    `SELECT ${collectionName}s.*, ` +
    scoreTable +
    `.rarity_rank FROM ${collectionName}s INNER JOIN ` +
    scoreTable +
    ` ON (${collectionName}s.id = ` +
    scoreTable +
    `.${collectionName}_id) `;
  let totalCollectionItemCountQueryValue = {};
  let collectionItemsQueryValue = {};

  if (!_.isEmpty(search)) {
    search = parseInt(search);
    totalCollectionItemCountQuery =
      totalCollectionItemCountQuery +
      ` WHERE ${collectionName}s.id LIKE :${collectionName}_id `;
    totalCollectionItemCountQueryValue[`${collectionName}_id`] =
      "%" + search + "%";

    collectionItemsQuery =
      collectionItemsQuery +
      ` WHERE ${collectionName}s.id LIKE :${collectionName}_id `;
    collectionItemsQueryValue[`${collectionName}_id`] = "%" + search + "%";
  } else {
    totalCollectionItemCount = totalCollectionItemCount;
  }

  let allTraitTypeIds = [];
  allTraits.forEach((trait) => {
    if (!allTraitTypeIds.includes(trait.trait_type_id.toString())) {
      allTraitTypeIds.push(trait.trait_type_id.toString());
    }
  });

  let purifySelectedTraits = [];
  if (selectedTraits.length > 0) {
    selectedTraits.map((selectedTrait) => {
      selectedTrait = selectedTrait.split("_");
      if (allTraitTypeIds.includes(selectedTrait[0])) {
        purifySelectedTraits.push(selectedTrait[0] + "_" + selectedTrait[1]);
      }
    });

    if (purifySelectedTraits.length > 0) {
      if (!_.isEmpty(search.toString())) {
        totalCollectionItemCountQuery = totalCollectionItemCountQuery + " AND ";
        collectionItemsQuery = collectionItemsQuery + " AND ";
      } else {
        totalCollectionItemCountQuery =
          totalCollectionItemCountQuery + " WHERE ";
        collectionItemsQuery = collectionItemsQuery + " WHERE ";
      }
      let count = 0;

      purifySelectedTraits.forEach((selectedTrait) => {
        selectedTrait = selectedTrait.split("_");
        totalCollectionItemCountQuery =
          totalCollectionItemCountQuery +
          " " +
          scoreTable +
          ".trait_type_" +
          selectedTrait[0] +
          "_value = :trait_type_" +
          selectedTrait[0] +
          "_value ";
        collectionItemsQuery =
          collectionItemsQuery +
          " " +
          scoreTable +
          ".trait_type_" +
          selectedTrait[0] +
          "_value = :trait_type_" +
          selectedTrait[0] +
          "_value ";
        if (count != purifySelectedTraits.length - 1) {
          totalCollectionItemCountQuery =
            totalCollectionItemCountQuery + " AND ";
          collectionItemsQuery = collectionItemsQuery + " AND ";
        }
        count++;

        totalCollectionItemCountQueryValue[
          "trait_type_" + selectedTrait[0] + "_value"
        ] = selectedTrait[1];
        collectionItemsQueryValue["trait_type_" + selectedTrait[0] + "_value"] =
          selectedTrait[1];
      });
    }
  }
  let purifyTraits = purifySelectedTraits.join(",");

  collectionItemsQuery =
    collectionItemsQuery + " " + orderByStmt + " LIMIT :offset,:limit";
  collectionItemsQueryValue["offset"] = offset;
  collectionItemsQueryValue["limit"] = limit;

  totalCollectionItemCount = db
    .prepare(totalCollectionItemCountQuery)
    .get(totalCollectionItemCountQueryValue);

  totalCollectionItemCount = [...Object.values(totalCollectionItemCount)][0];
  collectionItems = db
    .prepare(collectionItemsQuery)
    .all(collectionItemsQueryValue);
  let totalPage = Math.ceil(totalCollectionItemCount / limit);

  res.status(200).json({
    appTitle: config.app_name,
    appDescription: config.app_description,
    details: collectionDetails?.length
      ? collectionDetails[0]
      : {
          discord: "",
          twitter: "",
          collection_image: "",
          website: "",
        },
    ogTitle: config.collection_name + " | " + config.app_name,
    ogDescription:
      config.collection_description + " | " + config.app_description,
    ogUrl: req.protocol + "://" + req.get("host") + "/" + collectionName, //ogUrl: req.protocol + "://" + req.get("host") + req.originalUrl,
    ogImage: config.main_og_image,
    activeTab: "rarity",
    collectionItems: collectionItems,
    totalCollectionItemCount: totalCollectionItemCount,
    totalPage: totalPage,
    search: search,
    useTraitNormalization: useTraitNormalization,
    orderBy: orderBy,
    traits: purifyTraits,
    selectedTraits: purifySelectedTraits,
    allTraits: allTraits,
    page: page,
    totalSupply: totalSupply,
    allTraitTypesData: allTraitTypesData,
    item_path_name: config.item_path_name,
    collection_name: config.collection_name,
    _: _,
  });
});

router.get("/:collectionName/matrix", function (req, res, next) {
  let config, databasePath, db;

  const { collectionName } = req.params;

  if (!collectionName) {
    return res.status(400).json({
      success: false,
      message: "Invalid Collection",
    });
  }

  try {
    config = require(appRoot + `/config/${collectionName}_config.js`);

    config.sqlite_file_name = `${collectionName}.sqlite`;
    databasePath = appRoot + "/config/" + config.sqlite_file_name;

    db = new Database(databasePath);
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      success: false,
      message: "Invalid Collection",
    });
  }

  let allTraits = db
    .prepare(
      `SELECT trait_types.trait_type, trait_detail_types.trait_detail_type, trait_detail_types.${collectionName}_count FROM trait_detail_types INNER JOIN trait_types ON (trait_detail_types.trait_type_id = trait_types.id) WHERE trait_detail_types.${collectionName}_count != 0 ORDER BY trait_types.trait_type, trait_detail_types.trait_detail_type`
    )
    .all();
  let allTraitCounts = db
    .prepare(
      `SELECT * FROM ${collectionName}_trait_counts WHERE ${collectionName}_count != 0 ORDER BY trait_count`
    )
    .all();
  let totalCollectionItemCount = db
    .prepare(
      `SELECT COUNT(id) as ${collectionName}_total FROM ${collectionName}s`
    )
    .get();
  totalCollectionItemCount = [...Object.values(totalCollectionItemCount)][0];

  res.status(200).json({
    appTitle: config.app_name,
    appDescription: config.app_description,
    ogTitle: config.collection_name + " | " + config.app_name,
    ogDescription:
      config.collection_description + " | " + config.app_description,
    ogUrl:
      req.protocol +
      "://" +
      req.get("host") +
      req.originalUrl.replace("/matrix", ""), //ogUrl: req.protocol + "://" + req.get("host") + req.originalUrl,
    ogImage: config.main_og_image,
    activeTab: "matrix",
    allTraits: allTraits,
    allTraitCounts: allTraitCounts,
    totalCollectionItemCount: totalCollectionItemCount,
    _: _,
  });
});

router.get("/", (req, res, next) => {
  let files = fs.readdirSync(`${__dirname}/../config`);
  files = files
    .filter((el) => el.slice(-6) === "sqlite")
    .map((el) => el.slice(0, -7));

  let collection = [];
  files.forEach((file) => {
    let databasePath = appRoot + "/config/" + file + ".sqlite";

    const db = new Database(databasePath);
    let collectionDetails;
    try {
      collectionDetails = db.prepare(`SELECT * FROM ${file}_details`).all();
    } catch (err) {}

    const body = {
      name: file,
      content: "NO content",
      link: `/${file}`,
    };

    if (collectionDetails?.length) {
      body.details = collectionDetails[0];
    }

    console.log(file, "file");
    const config = require(appRoot + `/config/${file}_config.js`);

    body.name = config.collection_name;

    collection.push(body);
  });
  res.status(200).json({ collections: collection });
});

router.post("/add", (req, res) => {
  // ######## Code for validation of secret key is removed in order to prevent from Public Use ######
  let form = new formidable.IncomingForm();
  form.keepExtensions = true;
  form.parse(req, (err, fields, files) => {
    if (err) res.json({ err });
    try {
      var oldPath = files.collection.filepath;
      var newPath = `${__dirname}/../config/${files.collection.originalFilename}`;
      var rawData = fs.readFileSync(oldPath);
      fs.writeFileSync(newPath, rawData);
      oldPath = files.config.filepath;
      newPath = `${__dirname}/../config/${files.config.originalFilename}`;
      rawData = fs.readFileSync(oldPath);
      fs.writeFileSync(newPath, rawData);

      rarity_analyze(files.config.originalFilename);
      rarity_analyze_normalized(files.config.originalFilename);
      res.status(200).json({
        message: "Collection Added",
      });
    } catch (err) {
      console.log(err);
      res.status(400).json({
        message: "Something went wrong",
      });
    }
  });
});

module.exports = router;
