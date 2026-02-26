package lila.mailer

final private class MailerCli(mailer: Mailer)(using Executor):

  lila.common.Cli.handle:
    case "test-email" :: client :: address :: Nil =>
      EmailAddress.from(address) match
        case None => fuccess(s"Invalid email address: $address")
        case Some(email) =>
          mailer.sendTest(
            Mailer.Message(
              to = email,
              subject = "Lichess test email",
              text = "This is a test email from Lichess."
            ),
            clientName = client
          ) match
            case None =>
              fuccess:
                s"Unknown client '$client'. Available: ${mailer.clientNames.mkString(", ")}"
            case Some(funit) =>
              funit.inject(s"Test email sent to $address via $client client.")
