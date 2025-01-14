/* ****************************************************************************
 *
 * MMM-MailMessage
 *
 * This module looks for e-mails set to a specific address and displays the
 * subject line on the MagicMirror².
 *
 * It is heavily based on the MMM-Mail module by MMPieps found here:
 * https://github.com/MMPieps/MMM-Mail
 *
 * Author:  Roger Sinasohn (UncleRoger)
 * Written: 2023-11-01
 * Updated:
 *
 * Change History
 * 2023-11-01  UncleRoger  Initial Release
 *
 *************************************************************************** */

Module.register("MMM-MailMessage", {
  defaults: {
    host: "",
    port: 993,
    user: "",
    pass: "",
    subjectlength: 50,
    daysToDisplay: 0,
    minsToDisplay: 0,
    msgsToDisplay: 2,
    colorImport: "#ff0000",
    colorGood: "#00ff00",
    colorWarn: "#ffcc00",
    dispSender: "",
    dispSendPunc: " ",
    textSize: "large"
  },
  messages: [], // The storage for the Mails

  start: function () {
    console.log("MMM-MailMessage: E-mail module started!");
    this.sendSocketNotification("LISTEN_EMAIL", this.config);
    this.loaded = false;
  },

  socketNotificationReceived: function (notification, payload) {
    if (payload.user === this.config.user) {
      if (notification === "EMAIL_FETCH") {
        if (payload.messages) {
          this.messages.length = 0; //clear Message storage
          console.log("MMM-MailMessage: Email-Fetch Event");

          this.messages = payload.messages;
					console.log("MMM-MailMessage: Messages count - " + this.messages.length);

          if (this.messages.length > 0) {
            console.log(this.messages[0].id);
            this.messages.sort(function (a, b) {
              return b.id - a.id;
            });
          }

          for (let message of this.messages) {
            console.log("MMM-MailMessage: ID - " + message.id);
          }

          this.updateDom(2000);
        }
      }
      if (notification === "EMAIL_ERROR") {
        console.log("MMM-MailMessage: E-mail module restarted!");
        this.sendSocketNotification("LISTEN_EMAIL", this.config);
      }
    }
  },

  // Define required scripts.
  getStyles: function () {
    return ["email.css", "font-awesome.css"];
  },

  //=============================================================================

  getDom: function () {
    var wrapper = document.createElement("div");

    // ! = Important (default = red), + = Good News (def = green), * = Warn (Def = Yellow/Orange)
    const MODIFIERS = ["!", "+", "*"];
    const MIN_PER_DAY = 1440;
    const TEXT_SIZES = ["xsmall", "small", "medium", "large", "xlarge"];

    if (TEXT_SIZES.includes(this.config.textSize)) {
      wrapper.className = this.config.classes
        ? this.config.classes
        : `light ${this.config.textSize} bright pre-line`;
    } else {
      wrapper.className = this.config.classes
        ? this.config.classes
        : "light xlarge bright pre-line";
    }

    console.log("MMM-MailMessage: Starting MailMessage - count: " + this.messages.length);

    var that = this;
    var msgCount = 0;

    if (this.messages.length > 0) {
      //-----------------------------------------------------------------------------
      //  We're using a for/of loop to cycle through the new messages. We're not
      //  the slice method to get the first N messages because some messages might
      //  have expired or have come from an unauthorized sender. Instead, we want to
      //  keep going until we hit the limit (msgsToDisplay) or we find one that was
      //  sent prior to the max time (minsToDisplay & daysToDisplay).

      for (let thisMail of this.messages) {
        //var subject = thisMail.subject.replace(/[\['"\]]+/g,"");
        var subject = thisMail.subject.replace(/['"]+/g, "");

        console.log("MMM-MailMessage: Message Found - Subject: " + subject);
        console.log("                                 Date:    " + thisMail.date);

        // Trim leading spaces
        subject = subject.replace(/^\s+/gm, "");

        // Here we calculate how many minutes ago the message was sent.
        var minutesAgo = 0;
        minutesAgo = moment().diff(thisMail.date, "minutes");

        var cfgTime =
          that.config.daysToDisplay * MIN_PER_DAY + that.config.minsToDisplay;
        var dispTime = cfgTime;
        if (dispTime <= 0) {
          dispTime = 180;
        }

        // Senders can specify how long a message will display on the mirror.  This
        // code looks for a duration in "[dd:mmmm]" format at the beginning of the
        // e-mail subject.

        // Trim leading spaces
        subject = subject.replace(/^\s+/gm, "");

        var minDuration = -1;
        var subjTime = 0;

        var openBracket = subject.indexOf("[");
        var closeBracket = subject.indexOf("]");
        var locColon = subject.indexOf(":");
        if (locColon > closeBracket) {
          locColon = -1;
        }

        // The opening bracket must be in the first 6 characters and
        // the closing bracket must be in the first 12 to avoid trying
        // to interpret brackets in the actual subject.
        if (
          openBracket >= 0 &&
          openBracket <= 6 &&
          closeBracket <= 12 &&
          closeBracket > 0 &&
          openBracket < closeBracket
        ) {
          if (locColon >= 0 && locColon < closeBracket) {
            subjTime =
              +subject.substring(locColon + 1, closeBracket) +
              +subject.substring(openBracket + 1, locColon) * 1440;
          } else {
            subjTime = +subject.substring(openBracket + 1, closeBracket);
          }
          if (dispTime > subjTime) {
            dispTime = subjTime;
          }

          let leadSubject;
          // Here we remove the time info from the subject
          if (openBracket <= 0) {
            leadSubject = "";
          } else {
            leadSubject = subject.substring(0, openBracket);
          }
          subject =
            leadSubject + subject.substring(closeBracket + 1, subject.length);
        }

        // Trim leading spaces
        subject = subject.replace(/^\s+/gm, "");

        // Now we go through the list of valid senders to make sure the message came
        // from someone allowed to post messages.  If not, we ignore it.
        let selSender = that.config.validSenders.filter((mySender) => {
          if ( mySender.addr.toLowerCase() === thisMail.sender[0].address.toLowerCase() )
            return true;
          else 
            return false;
        });

        // If the sender was legit and it's not too old (or in the future), we start
        // building the message for display in messageWrapper.
        if (selSender.length > 0 && minutesAgo >= 0 && minutesAgo <= dispTime) {
          const messageWrapper = document.createElement("span");

          //-----------------------------------------------------------------------------
          // Here we're going to see if we need to set the text to a color. First, we
          // check any of the modifiers, !, +, and *. If none of those are present,
          // we'll check to see if the sender has an associated color. If not, then
          // we set it to the general text color. Lastly, if there was a modifier,
          // it gets removed via the substring method.
          var msgStat = subject.substring(0, 1);
          switch (true) {
            case msgStat === "!":
              messageWrapper.style.color = that.config.colorImport;
              break;
            case msgStat === "+":
              messageWrapper.style.color = that.config.colorGood;
              break;
            case msgStat === "*":
              messageWrapper.style.color = that.config.colorWarn;
              break;
            case selSender[0].color !== undefined:
              messageWrapper.style.color = selSender[0].color;
              break;
            case that.config.colorText !== undefined:
              messageWrapper.style.color = that.config.colorText;
              break;
          }

          if (MODIFIERS.includes(msgStat)) {
            subject = subject.substring(1, subject.length);
          }

          //-----------------------------------------------------------------------------
          // If a maximum length was set in the config, we'll trim the message to
          // that length.  Note: we do this after removing the modifier but before
          // any other modifications (such as adding sender name).
          //cut the subject
          if (subject.length > that.config.subjectlength) {
            subject = subject.substring(0, that.config.subjectlength);
          }

          // Possibly add option longScroll (boolean) so that long messages scroll
          // rather than wrap.  See MMM-NewsFeedTicker for sample.
          //          if (that.config.longScroll) {
          //            messageWrapper. = add code to make message scroll...

          //-----------------------------------------------------------------------------
          //  If dispSender is set, we will prepend (= prefix) or append (= suffix) the
          //  sender name to the subject, along with the value of dispSendPunc.
          switch (that.config.dispSender.toLowerCase()) {
            case "prefix":
              if (selSender[0].name !== undefined) {
                subject =
                  selSender[0].name + that.config.dispSendPunc + subject;
              }
              break;
            case "suffix":
              if (selSender[0].name !== undefined) {
                subject =
                  subject + that.config.dispSendPunc + selSender[0].name;
              }
              break;
          }

          // Now we bundle it all up to be displayed.
          messageWrapper.appendChild(document.createTextNode(subject));
          wrapper.appendChild(messageWrapper);
					
          // Add a break
          wrapper.appendChild(document.createElement("BR"));

          msgCount++;
        }

        if ( msgCount >= that.config.msgsToDisplay || minutesAgo < 0 || minutesAgo >= cfgTime ) {
          break;
        }
      }
    }

    if (wrapper.children.length > 0) {
      wrapper.lastElementChild.remove();
    }

    return wrapper;
  }
});
