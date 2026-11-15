# MedImagingSim

MedImagingSim is a web-based imaging workflow simulator. The first milestone provides standalone sign-in and the shared Radiology Information System (RIS) with two fictional MRI practice scenarios.

## Run locally

Use Node.js 24 or later. The app uses Node's HTTP server and SQLite driver and has no package dependencies.

```sh
npm run create-user -- admin admin
npm start
```

The account command prints a generated password. Open [MedImagingSim](http://127.0.0.1:3000) and sign in as `admin`. The local server binds to 127.0.0.1 and stores its SQLite database in `data/medimagingsim.sqlite` by default. Set `MEDSIM_PORT` to change the port. Set `MEDSIM_DB` for both account creation and the server to use a different database path.

## Verify with the superuser

1. As admin, launch **Routine brain MRI** from **RIS worklist**. Review the history and submit **No** for all three answers. The order shows **Ready for console**.
2. Return to the worklist and launch **Implant review**. Review the history and select **Yes** or **Unsure** for the implant question. The order shows **Screening hold**.
3. Select **Instructor home** in the header, then return to **RIS worklist** with the same session. The admin worklist includes every order and its owner.
4. Sign out and back in as admin. Both orders retain their accession, status, and submitted answers.

The screening scenarios are fictional training exercises. Responses are read-only once submitted in this milestone. The MRI acquisition console is scheduled for Milestone 2.

## Dedicated role testing

After the admin walkthrough passes, create separate test accounts with `npm run create-user -- student1 student` and `npm run create-user -- instructor1 instructor`.

Run `npm test` for automated coverage of the admin workflow, role boundaries, database migration, screening, and persistence through the request handler and an on-disk SQLite database.

See the [milestone plan](MILESTONE_PLAN.md) for the implementation sequence and handoff notes.
