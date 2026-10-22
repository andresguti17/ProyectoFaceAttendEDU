import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { saveInstitutionConfig } from "../../../../core/config/institutionConfig";
import { useAutomaticPeriodAdvance } from "../useAutomaticPeriodAdvance";

function Probe({ enabled, onAdvanced }) {
    useAutomaticPeriodAdvance(enabled, 60, onAdvanced);
    return null;
}

function mount(props) {
    let tree;
    act(() => {
        tree = create(<Probe {...props} />);
    });
    return tree;
}

const expiredPeriod = { isAutomaticPeriod: true, periodStartDate: "2020-01-01", periodEndDate: "2020-03-31" };

beforeEach(() => {
    localStorage.clear();
    jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

test("an expired automatic period advances once and hands the new dates to the caller to save", async () => {
    saveInstitutionConfig(expiredPeriod);
    const onAdvanced = jest.fn().mockResolvedValue(undefined);

    await act(async () => {
        mount({ enabled: true, onAdvanced });
    });

    expect(onAdvanced).toHaveBeenCalledTimes(1);
    expect(onAdvanced).toHaveBeenCalledWith({ periodStartDate: "2020-04-01", periodEndDate: "2020-06-29" });
});

test("when it is not enabled (every role but a school admin) nothing is advanced or saved", async () => {
    saveInstitutionConfig(expiredPeriod);
    const onAdvanced = jest.fn();

    await act(async () => {
        mount({ enabled: false, onAdvanced });
    });

    expect(onAdvanced).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("faceattend_institution_config")).periodEndDate).toBe("2020-03-31");
});

test("a period that has not expired is left alone", async () => {
    saveInstitutionConfig({ isAutomaticPeriod: true, periodStartDate: "2020-01-01", periodEndDate: "2999-01-01" });
    const onAdvanced = jest.fn();

    await act(async () => {
        mount({ enabled: true, onAdvanced });
    });

    expect(onAdvanced).not.toHaveBeenCalled();
});
