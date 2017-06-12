"use strict";

const express = require('express');
const models = require('../models');
const amazon = require('amazon-product-api');
const Product = models.Product;
const router = express.Router();
const amazon_client = amazon.createClient({
  awsId: "AKIAJ57L27I3YHIMBQJA",
  awsSecret: "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"
});

/**************************GET**************************/
//Affichage de la bibliothèque d'un utilisateur (liste des produits sans description)
router.get('/users/:user_id', function(req, res, next){
  let l = parseInt(req.query.limit) || 20;
  let o = parseInt(req.query.offset) || 0;
  let result = [];
  let options = {
    limit : l,
    offset : o,
  };

  Product.findAll({options, where: {UserId : req.params.user_id}} )
  .then(function(products) {
    for(let product of products) {
      result.push(product.responsify());
    }
    res.json(result);
  }).catch(function(err){
    res.json({result: -1});
  });

});

//Affichage d'un produit d'un utilisateur (avec description)
router.get('/:product_id', function(req, res, next){
  Product.find({
    where: {
      id : req.params.product_id
    }
  }).then(function(product){
    if(product){
      let asin = product.ASINCode;
      let info = [];

      amazon_client.itemLookup({
        itemId: asin,
        responseGroup: 'ItemAttributes'
      },function(err, results, response){
        if(results){
          let type = results[0].ItemAttributes[0]["ProductGroup"][0];

          if(type == 'DVD'){
            info['title'] = results[0].ItemAttributes[0]["Title"][0];
            info['producer'] = results[0].ItemAttributes[0]["Director"][0];
            info['actors'] = results[0].ItemAttributes[0]["Actor"][0];
            info['format'] = results[0].ItemAttributes[0]["Format"][0];
          }
          if(type == 'Music'){
            info['title'] = results[0].ItemAttributes[0]["Title"][0];
            info['artist'] = results[0].ItemAttributes[0]["Artist"][0];
            info['discs'] = results[0].ItemAttributes[0]["NumberOfDiscs"][0];
          }
          if(type == 'Video Game'){
            info['title'] = results[0].ItemAttributes[0]["Title"][0];
            info['description'] = results[0].ItemAttributes[0]["Feature"][0];
            info['studio'] = results[0].ItemAttributes[0]["Studio"][0];
            info['genre'] = results[0].ItemAttributes[0]["Genre"][0];
            info['platform'] = results[0].ItemAttributes[0]["Platform"][0];
          }
          if(type == 'Book'){
            info['title'] = results[0].ItemAttributes[0]["Title"][0];
            info['author'] = results[0].ItemAttributes[0]["Author"][0];
            info['type'] = results[0].ItemAttributes[0]["Binding"][0];
            info['manufacturer'] = results[0].ItemAttributes[0]["Manufacturer"][0];
            info['pages'] = results[0].ItemAttributes[0]["NumberOfPages"][0];
            info['isbn'] = results[0].ItemAttributes[0]["ISBN"][0];
          }

          res.json(info);
        }
      });

    }
    res.json({result: 404}); //PRODUCT NOT FOUND
  }).catch(function(err){
    res.json({result: -1});
  });
});


/**************************POST**************************/
//Ajout d'un produit à la bibliothèque de l'utilisateur via code ASIN
//Recherche du produit via code ASIN
//Puis ajout à la bibliothèque
router.post('/add', function(req, res, next) {
  let asin = req.body.asin;
  let user = req.body.user;
  let date = new Date();
  let n;
  let bc;
  let pt;

  amazon_client.itemLookup({
    itemId: asin,
    responseGroup: 'ItemAttributes'
  }, function(err, results, response) {
    if (results) {
      n = results[0].ItemAttributes[0]["Title"][0];
      pt = results[0].ItemAttributes[0]["ProductGroup"][0];
      bc = results[0].ItemAttributes[0]["EAN"][0];

      //Ajout en BDD
      Product.create({
        barCode: bc,
        name : n,
        add_date: date,
        productType: pt,
        ASINCode: asin,
        UserId : user
      }).then(function(product){
        res.json(product);
      }).catch(function(err){
        console.log(err);
        res.json({result: -1}); //SEQUELIZE ERROR
      });

    } else {
      console.log(err.Error);
    }
  });

});

//Recherche de produits par EAN/Keywords/Type/ASIN
//EAN & ASIN -> Retourne un élément
//Keywords & Type -> Retourne une liste
//TODO : Affichage Pretty
router.post('/find', function(req, res, next) {
  let type = req.body.type;
  let value = req.body.value;

  if (type == 'EAN') {
    amazon_client.itemLookup({
      idType: 'EAN',
      itemId: value,
      responseGroup: 'ItemAttributes'
    }, function(err, results, response) {
      if (err) {
        res.json(err);
      } else {
        res.json(results);
      }
    });
  }
  if (type == 'ASIN') {
    amazon_client.itemLookup({
      itemId: value,
      responseGroup: 'ItemAttributes'
    }, function(err, results, response) {
      if (err) {
        res.json(err);
      } else {
        res.json(results);
      }
    });
  }
  else if (type == 'Keywords') {
    amazon_client.itemSearch({
      keywords : value,
      responseGroup: 'ItemAttributes'
    }).then(function(results){
      res.json(results);
    }).catch(function(err){
      res.json(err);
    });
  }
  else if (type == 'Type') {
    amazon_client.itemSearch({
      keywords : value,
      searchIndex: value,
      responseGroup: 'ItemAttributes',
      VariationPage : 1,
      sort:"salesrank"
    }).then(function(results){
      res.json(results);
    }).catch(function(err){
      res.json(err);
    });
  }
});

/**************************END**************************/
module.exports = router;
