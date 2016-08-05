import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Meteor } from 'meteor/meteor';
import { Auctions } from '/imports/api/auctions.js';
import { Auctionlets } from '/imports/api/auctionlets.js';
import { Tokens } from '/imports/api/tokens.js';
import { Transactions } from '/imports/lib/_transactions.js';

import './main.html';
import '/imports/client/network-status.js';
import '/imports/startup/client/index.js';
import '/imports/helpers.js';

var timeRemaining = new ReactiveVar(0)

function doCountdown() {
  let singleAuctionlet = Auctionlets.findAuctionlet()
  let singleAuction = Auctions.findAuction()
  let currentTime = (new Date).getTime()
  console.log('current time', currentTime)
  console.log(singleAuction.duration)
  if(singleAuction != undefined && singleAuctionlet != undefined) {
    let countdown = (singleAuction.duration * 1000 - (currentTime - singleAuctionlet.last_bid_time.getTime())) / 1000
    console.log(countdown)
    if(countdown >= 0) {
      timeRemaining.set(Math.round(countdown))
    }
  }
}

Template.body.onCreated(function() {
  this.autorun(() => {
    let network = Session.get('network')
    let address = Session.get('address')
    if (network && address) {
      Auctionlets.watchBid();
      Tokens.watchEthApproval()
      Tokens.watchMkrApproval();
    }
  });

  Tokens.watchEthAllowanceTransactions();
  Tokens.watchMkrAllowanceTransactions();
  Auctionlets.watchBidTransactions();
  Auctions.watchNewAuction();
  Auctions.watchNewAuctionTransactions();
  Auctionlets.watchClaimTransactions();
  Meteor.setInterval(doCountdown, 1000)
})

Template.balance.viewmodel({
  account() {
    return Session.get("address")
  }
});

Template.auction.viewmodel({
  auction() {
    let singleAuction = Auctions.findAuction()
    return singleAuction;
  },
  contractaddress() {
    return TokenAuction.objects.auction.address;
  }
});

Template.auctionlet.viewmodel({
  auctionlet() {
    let singleAuctionlet = Auctionlets.findAuctionlet()
    let singleAuction = Auctions.findAuction()
    if(singleAuctionlet != undefined && singleAuction != undefined) {
      let requiredBid = Auctionlets.calculateRequiredBid(singleAuctionlet.buy_amount, singleAuction.min_increase)
      this.bid(web3.fromWei(requiredBid))
    }
    return singleAuctionlet
  },
  bid: 0,
  bidMessage() {
    return Session.get('bidMessage')
  },
  countdown() {
    return timeRemaining.get()
  },
  create(event) {
    event.preventDefault();
    Session.set('bidMessage', null)
    let auctionletBid = web3.toWei(this.bid())
    let auction = Auctions.findAuction();
    let auctionlet = Auctionlets.findAuctionlet()

    if(auction != undefined && Tokens.isBalanceSufficient(auctionletBid, auction.buying)) {
      if(auctionlet != undefined && auctionletBid >= Auctionlets.calculateRequiredBid(auctionlet.buy_amount, auction.min_increase)) {
        Auctionlets.doBid(auctionletBid);
      }
      else {
        Session.set('bidMessage', 'Bid is not high enough')
      }
    }
    else {
      Session.set('bidMessage', 'Your balance is insufficient for your current bid')
    }
  },
  expired() {
    let auctionlet = Auctionlets.findAuctionlet()
    return auctionlet != undefined && auctionlet.isExpired
  },
  unclaimed() {
    let auctionlet = Auctionlets.findAuctionlet()
    return auctionlet != undefined && auctionlet.auction_id != "0" && auctionlet.unclaimed
  },
  auctionwinner() {
    let auctionlet = Auctionlets.findAuctionlet()
    return this.expired() && auctionlet != undefined && Session.get('address') == auctionlet.last_bidder && auctionlet.unclaimed
  },
  claimMessage() {
    return Session.get('claimMessage')
  },
  claim(event) {
    event.preventDefault();
    let auctionlet = Auctionlets.findAuctionlet()
    if(auctionlet.unclaimed && this.expired()) {
      Auctionlets.doClaim(Session.get('currentAuctionletId'))
    }
  }
});

Template.newauction.viewmodel({
  sellamount: 0,
  startbid: 0,
  minimumincrease: 0,
  duration: 0,
  newAuctionMessage() {
    return Session.get('newAuctionMessage')
  },
  newAuctionUrl() {
    return Session.get('newAuctionUrl')
  },
  create(event) {
    event.preventDefault();
    let weiSellAmount = web3.toWei(this.sellamount())
    let weiStartBid = web3.toWei(this.startbid())
    let network = Session.get('network')
    let address = Tokens.getTokenAddress(network, 'MKR')
    if(Tokens.isBalanceSufficient(weiSellAmount, address)) {
      let newAuction = {
                        sellamount: weiSellAmount,
                        startbid: weiStartBid,
                        min_increase: this.minimumincrease(),
                        duration: this.duration()
                      }
      Session.set("newAuction", newAuction)
      Auctions.createAuction(web3.toWei(this.sellamount()));
    }
    else {
      Session.set('newAuctionMessage', 'Error creating new auction, MKR balance insufficient')
    }
  }
});

Template.transactions.viewmodel({
  transactions() {
    return Transactions.find({});
  }
});

Template.tokens.viewmodel({
  tokens() {
    return Tokens.find({});
  }
});