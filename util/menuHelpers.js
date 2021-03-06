const Menu = require("../db/models/menuItem"),
  S3 = require("../aws/imageHelpers");

const {
  saveNewMenuItem,
  updateExistingMenuItem,
  removeMenuItemById,
} = require("../db/actions/menuItem");

/**
 * This method parses the request body sent to the express.
 * It returns a Menu object that matches Menu Model in the database
 *
 * @param {Request} req Request sent to the express
 * @returns {obj} Menu entity based on the request
 * @public
 */
function parseMenuForm(req) {
  const menuItem = req.body.menu;

  // Check if the category specified is new. If true, get the new category name
  if (menuItem["category"].toLowerCase() == "new") {
    menuItem.category = req.body.newCategory;
  }

  // Add pricing options
  menuItem.options = parseRawOptions(req.body.pricing);

  // add modifiers
  menuItem.modifiers = parseRawModifiers(req.body.modifiers);

  // add tags
  menuItem.tags = (req.body.tags && parseRawTags(req.body.tags)) || [];

  return menuItem;
}

function parseRawOptions(rawPricing) {
  let options = [];
  // Multiple options has been added
  if (rawPricing["price"] instanceof Array) {
    for (var i = 0; i < rawPricing["title"].length; i++) {
      options.push({
        price: Number.parseFloat(rawPricing["price"][i]),
        title: rawPricing["title"][i],
      });
    }
  } else {
    options = [
      {
        price: Number.parseFloat(rawPricing["price"]),
        title: rawPricing["title"],
      },
    ];
  }

  return options;
}

function parseRawTags(rawTags) {
  let parsedTags = [];

  if (!(rawTags.title instanceof Array)) {
    let currentTagTitle = rawTags.title.trim();
    let currentTagColor = rawTags.color.trim();

    rawTags.title = [currentTagTitle];
    rawTags.color = [currentTagColor];
  }

  for (let i = 0; i < rawTags.title.length; i++) {
    let title = rawTags.title[i].trim();
    let color = rawTags.color[i].trim();

    if (title.length === 0 && color.length === 0) {
      continue;
    } else if (title.length === 0) {
      throw "Title of the tag must be provided";
    } else if (color.length === 0) {
      throw "Color for the tag must be selected";
    }

    parsedTags.push({ title, color });
  }

  return parsedTags;
}

function parseRawModifiers(rawModifiers) {
  if (!rawModifiers) {
    return {
      multiSelect: false,
      values: [],
    };
  }

  const multiSelectModifier =
    rawModifiers["multiSelect"] && rawModifiers["multiSelect"] === "on";
  const parsedModifiers = {
    multiSelect: multiSelectModifier || false,
    values: [],
  };

  let modifierValues = rawModifiers.values;
  if (!modifierValues) {
    return parsedModifiers;
  }

  if (!(modifierValues.title instanceof Array)) {
    let currentTitle = modifierValues.title.trim();
    let currentPrice = modifierValues.price.trim();

    // Convert string into array
    modifierValues.title = [currentTitle];
    modifierValues.price = [currentPrice];
  }

  for (var i = 0; i < modifierValues.price.length; i++) {
    let title = modifierValues.title[i].trim();
    let price = modifierValues.price[i].trim();

    if (title.length === 0 && price.length === 0) {
      continue;
    } else if (title.length === 0) {
      throw "Title of the modifier must be provided";
    } else if (price.length === 0) {
      throw "Price for the modifier must be provided";
    }

    price = Number.parseFloat(price);
    // Check for NaN
    if (!price) {
      throw "Valid price must be provided for the modifier";
    }

    parsedModifiers.values.push({ title, price });
  }

  return parsedModifiers;
}

/**
 * This method adds a new menu object to the database
 * It validates the object to be inserted and throws exception if not valid.
 * The caller must handle all exceptions.
 *
 * @param {obj} menuItem menu to be added
 * @returns {Promise<obj>} newly created Menu document
 * @public
 */
async function addNewMenuItem(menuItem) {
  // Ensure the prices are valid
  if (!hasValidPrices(menuItem.options)) {
    throw "All prices must be atleast $ 0.01";
  }

  return saveNewMenuItem(menuItem);
}

/**
 * This method updates the document based on the provided id and new data.
 * It validates the new data and throws exception if it is no valid.
 * The caller must handle all exceptions.
 *
 * @param {string | Mongoose.ObjectId} menuId Id of the document to be updated
 * @param {obj} newMenuItem new contents for the document
 * @returns {Promise<obj>} updated document
 * @public
 */
async function updateMenuItem(menuId, newMenuItem) {
  if (!hasValidPrices(newMenuItem.options)) {
    throw "All prices must be atleast $ 0.01";
  }

  return updateExistingMenuItem(menuId, newMenuItem);
}

/**
 * This method deletes the Menu document based on the provided id
 *
 * @param {string | Mongoose.ObjectId} menuId
 * @public
 */
async function deleteMenuItem(menuId) {
  await removeMenuItemById(menuId).then((item) => {
    if (item && item.image && item.image.key) {
      S3.deleteImage(item.image.key).catch((err) => console.log(err));
    }
  });
}

/**
 * This method validates all the prices are populated correctly.
 * It must be atleast $0.01
 *
 * @param {Array<obj>} options different options for the menu item
 * @returns {boolean} true if the prices are valid
 */
function hasValidPrices(options) {
  return options.every((option) => option.price >= 0.01);
}

module.exports = {
  parseMenuForm,
  addNewMenuItem,
  updateMenuItem,
  deleteMenuItem,
};
